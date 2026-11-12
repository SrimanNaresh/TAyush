// Next shared patient code (P000001 ...), the same series Lab's nextCode()
// uses. As SQL so it can sit inside an INSERT; UPDLOCK/HOLDLOCK keeps two
// saves from picking the same number.
export const NEXT_PATIENT_CODE_SQL = `(SELECT 'P' + RIGHT('000000' + CAST(ISNULL(MAX(TRY_CAST(SUBSTRING(PatientCode, 2, 20) AS INT)), 0) + 1 AS VARCHAR(10)), 6)
  FROM Patient WITH (UPDLOCK, HOLDLOCK) WHERE PatientCode LIKE 'P%' AND LEN(PatientCode) = 7)`;
