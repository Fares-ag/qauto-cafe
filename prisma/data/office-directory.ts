/**
 * Office phone directory for the register.
 * Replace or extend this list with your real extension data.
 */
export type OfficeDirectoryEntry = {
  extension: string;
  name: string;
  department: string;
};

export const OFFICE_DIRECTORY: OfficeDirectoryEntry[] = [
  { extension: '1001', name: 'Reception', department: 'Front Office' },
  { extension: '1101', name: 'Ahmed Al-Mahmoud', department: 'Engineering' },
  { extension: '1102', name: 'Sara Hassan', department: 'Engineering' },
  { extension: '1201', name: 'Omar Khalid', department: 'Finance' },
  { extension: '1202', name: 'Layla Nasser', department: 'Finance' },
  { extension: '1301', name: 'Fatima Ali', department: 'Human Resources' },
  { extension: '1401', name: 'Mohammed Saleh', department: 'Operations' },
  { extension: '1402', name: 'Noor Ibrahim', department: 'Operations' },
  { extension: '1501', name: 'Executive Assistant', department: 'Management' },
  { extension: '1502', name: 'Board Room', department: 'Management' },
];

export const OFFICE_DEPARTMENTS = [
  ...new Set(OFFICE_DIRECTORY.map((e) => e.department)),
].sort();
