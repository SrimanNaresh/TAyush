"""Deploy Ayush ALL IN ONE to 156.67.104.242.

  python scripts/deploy.py status     # what is running there (read-only)
  python scripts/deploy.py deploy     # build, upload, npm ci, init-db, PM2 on port 5160
  python scripts/deploy.py cutover    # point tayush at the new app, stop the old suite
  python scripts/deploy.py rollback   # undo cutover: old nginx site + old PM2 process back
  python scripts/deploy.py golive     # deploy, then cutover, with one login

Login: SSH key (DEPLOY_KEY=path) or password (DEPLOY_PASSWORD, else asked).
Nothing secret is stored in this file. The server's backend/.env is kept on
every deploy; it is only created from the local one the first time.
"""
import getpass
import io
import os
import sys
import tarfile
import time
import subprocess

import paramiko

HOST = os.environ.get('DEPLOY_HOST', '156.67.104.242')
USER = os.environ.get('DEPLOY_USER', 'root')
APP_DIR = '/opt/projects/ayushallinone'
PM2_NAME = 'ayushallinone'
PORT = 5160
DOMAIN = 'tayush.thangaminfotech.com'
OLD_SITE = 'thangamsuite-tayush.conf'      # the old suite's nginx site for tayush
OLD_PM2 = 'thangamsuite'                   # the old suite's PM2 process
NEW_SITE = 'ayushallinone-tayush.conf'
BACKUP_DIR = '/root/backups/ayushallinone-cutover'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'node_modules', '.env', 'dist', '.git', 'uploads'}


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key = os.environ.get('DEPLOY_KEY')
    if key:
        c.connect(HOST, username=USER, key_filename=key, timeout=20)
    else:
        pw = os.environ.get('DEPLOY_PASSWORD') or getpass.getpass(f'Password for {USER}@{HOST}: ')
        c.connect(HOST, username=USER, password=pw, timeout=20, look_for_keys=False, allow_agent=False)
    return c


def run(c, cmd, check=True, quiet=False):
    if not quiet:
        print(f'$ {cmd}')
    _, out, err = c.exec_command(cmd, get_pty=False)
    code = out.channel.recv_exit_status()
    o, e = out.read().decode(errors='replace'), err.read().decode(errors='replace')
    if not quiet and o.strip():
        print(o.rstrip())
    if code != 0:
        if e.strip():
            print(e.rstrip())
        if check:
            raise SystemExit(f'Command failed ({code}): {cmd}')
    return code, o


def add_tree(tar, src, arc):
    for base, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in SKIP]
        for f in files:
            if f in SKIP:
                continue
            full = os.path.join(base, f)
            tar.add(full, arcname=os.path.join(arc, os.path.relpath(full, src)).replace(os.sep, '/'))


def build_bundle():
    print('Building frontend ...')
    subprocess.run('npm run build', cwd=os.path.join(ROOT, 'frontend'), shell=True, check=True)
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        add_tree(tar, os.path.join(ROOT, 'backend'), 'backend')
        tar.add(os.path.join(ROOT, 'frontend', 'dist'), arcname='frontend/dist')
        add_tree(tar, os.path.join(ROOT, 'deploy'), 'deploy')
        add_tree(tar, os.path.join(ROOT, 'docs'), 'docs')
    buf.seek(0)
    return buf


def status(c):
    run(c, 'hostname; node -v; pm2 -v', check=False)
    run(c, 'pm2 ls', check=False)
    run(c, f"ss -ltnp | grep -E ':(5150|{PORT})\\b' || true", check=False)
    run(c, f'ls -l /etc/nginx/sites-enabled | grep -iE "tayush|thangamsuite|ayushallinone" || true', check=False)
    run(c, f'curl -s -o /dev/null -w "local api %{{http_code}}\\n" http://127.0.0.1:{PORT}/api/health || true', check=False)


def deploy(c):
    _, used = run(c, f"ss -ltnp | grep -E ':{PORT}\\b' || true", quiet=True)
    if used.strip() and PM2_NAME not in run(c, 'pm2 jlist', check=False, quiet=True)[1]:
        raise SystemExit(f'Port {PORT} is already used by something else on the server:\n{used}')
    bundle = build_bundle()
    stamp = time.strftime('%Y%m%d-%H%M%S')
    remote_tar = f'/tmp/ayushallinone-{stamp}.tgz'
    sftp = c.open_sftp()
    sftp.putfo(bundle, remote_tar)
    print(f'Uploaded {remote_tar}')
    run(c, f'mkdir -p {APP_DIR} && cd {APP_DIR} && rm -rf frontend/dist && tar -xzf {remote_tar} && rm -f {remote_tar}')
    code, _ = run(c, f'test -f {APP_DIR}/backend/.env', check=False, quiet=True)
    if code != 0:
        print('Creating server backend/.env from the local one (first deploy)')
        sftp.put(os.path.join(ROOT, 'backend', '.env'), f'{APP_DIR}/backend/.env')
        run(c, f'chmod 600 {APP_DIR}/backend/.env')
    sftp.close()
    run(c, f'cd {APP_DIR}/backend && npm ci --omit=dev --no-audit --no-fund')
    run(c, f'cd {APP_DIR}/backend && npm run init-db')
    run(c, f'cd {APP_DIR} && pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save')
    time.sleep(3)
    run(c, f'curl -sf http://127.0.0.1:{PORT}/api/health')
    print('\n--- server status ---')
    status(c)
    code, _ = run(c, f'test -L /etc/nginx/sites-enabled/{NEW_SITE}', check=False, quiet=True)
    where = f'https://{DOMAIN} is live with this version.' if code == 0 else f'{DOMAIN} still serves the old suite until "cutover".'
    print(f'\nDeployed. API on port {PORT}. {where}')


def cutover(c):
    run(c, f'test -f {APP_DIR}/frontend/dist/index.html && curl -sf http://127.0.0.1:{PORT}/api/health >/dev/null')
    stamp = time.strftime('%Y%m%d-%H%M%S')
    bdir = f'{BACKUP_DIR}/{stamp}'
    run(c, f'mkdir -p {bdir} && cp -a /etc/nginx/sites-available/{OLD_SITE} {bdir}/ 2>/dev/null; '
           f'ls -l /etc/nginx/sites-enabled > {bdir}/sites-enabled.txt; echo {bdir} > {BACKUP_DIR}/LAST')
    run(c, f'rm -f /etc/nginx/sites-enabled/{OLD_SITE}')
    run(c, f'cp {APP_DIR}/deploy/nginx-tayush.conf /etc/nginx/sites-available/{NEW_SITE} && '
           f'ln -sf /etc/nginx/sites-available/{NEW_SITE} /etc/nginx/sites-enabled/{NEW_SITE}')
    code, _ = run(c, 'nginx -t', check=False)
    if code != 0:
        print('nginx test failed: restoring the old site')
        rollback(c)
        raise SystemExit(1)
    run(c, 'systemctl reload nginx')
    run(c, f'pm2 stop {OLD_PM2} && pm2 save', check=False)
    print(f'\nCut over: https://{DOMAIN} now serves Ayush ALL IN ONE. Backup in {bdir}.')


def rollback(c):
    _, last = run(c, f'cat {BACKUP_DIR}/LAST', quiet=True)
    bdir = last.strip()
    run(c, f'rm -f /etc/nginx/sites-enabled/{NEW_SITE}')
    run(c, f'test -f {bdir}/{OLD_SITE} && cp -a {bdir}/{OLD_SITE} /etc/nginx/sites-available/{OLD_SITE}; '
           f'ln -sf /etc/nginx/sites-available/{OLD_SITE} /etc/nginx/sites-enabled/{OLD_SITE}')
    run(c, 'nginx -t && systemctl reload nginx')
    run(c, f'pm2 start {OLD_PM2} && pm2 save', check=False)
    print(f'\nRolled back: {DOMAIN} serves the old suite again.')


if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'status'
    def golive(c):
        deploy(c)
        cutover(c)
        run(c, f"ss -ltnp | grep -E ':{PORT}\\b' || true")
        run(c, f'curl -sk -o /dev/null -w "https {DOMAIN} %{{http_code}}\\n" --resolve {DOMAIN}:443:127.0.0.1 https://{DOMAIN}/api/health', check=False)

    fn = {'status': status, 'deploy': deploy, 'cutover': cutover, 'rollback': rollback, 'golive': golive}.get(action)
    if not fn:
        raise SystemExit(__doc__)
    client = connect()
    try:
        fn(client)
    finally:
        client.close()
