// Store Timeline Generation & Scheduling Library
// Based on template tasks with anchor dates (OPEN_DATE, CONTRACT_SIGNED, etc.)

import { addDays, addBusinessDays, differenceInCalendarDays } from 'date-fns';

// --- Date Math ---
export function calculateDate(baseDate: Date, offset: number, rule: string): Date {
  let result = new Date(baseDate);
  if (rule === 'BUSINESS_DAYS_MON_FRI' || rule === 'BUSINESS_DAYS') {
    result = addBusinessDays(result, offset);
  } else {
    result = addDays(result, offset);
  }
  return result;
}

// Template task definition for timeline generation
export interface TemplateTaskDef {
  name: string;
  phase: string;
  anchorEvent: 'OPEN_DATE' | 'CONTRACT_SIGNED' | 'CONSTRUCTION_START' | string;
  offsetDays: number;
  durationDays: number;
  workdayRule: 'CALENDAR_DAYS' | 'BUSINESS_DAYS_MON_FRI';
  roleResponsible?: string;
  isMilestone?: boolean;
  order: number;
}

// Default template tasks for a standard store opening
export const DEFAULT_TEMPLATE_TASKS: TemplateTaskDef[] = [
  // Phase 0: Deal / Planning
  { name: 'Approve Budget', phase: 'Deal / Planning', anchorEvent: 'OPEN_DATE', offsetDays: -180, durationDays: 5, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'ADMIN', order: 1 },
  { name: 'Define Store Concept & Format', phase: 'Deal / Planning', anchorEvent: 'OPEN_DATE', offsetDays: -175, durationDays: 5, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 2 },
  { name: 'Site Survey / Feasibility', phase: 'Deal / Planning', anchorEvent: 'OPEN_DATE', offsetDays: -175, durationDays: 7, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 3 },
  { name: 'Lease Negotiation', phase: 'Deal / Planning', anchorEvent: 'OPEN_DATE', offsetDays: -170, durationDays: 21, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'ADMIN', order: 4 },
  { name: 'Contract Signed', phase: 'Deal / Planning', anchorEvent: 'CONTRACT_SIGNED', offsetDays: 0, durationDays: 0, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'ADMIN', isMilestone: true, order: 5 },
  { name: 'Sign Lease', phase: 'Deal / Planning', anchorEvent: 'OPEN_DATE', offsetDays: -145, durationDays: 1, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'ADMIN', order: 6 },
  { name: 'Kickoff: Master Launch Plan', phase: 'Deal / Planning', anchorEvent: 'OPEN_DATE', offsetDays: -144, durationDays: 2, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 7 },

  // Phase 1: Design & Permits
  { name: 'Select Architect / Designer', phase: 'Design & Permits', anchorEvent: 'OPEN_DATE', offsetDays: -140, durationDays: 5, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 8 },
  { name: 'Schematic Layout Design', phase: 'Design & Permits', anchorEvent: 'OPEN_DATE', offsetDays: -135, durationDays: 10, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 9 },
  { name: 'MEP Plan', phase: 'Design & Permits', anchorEvent: 'OPEN_DATE', offsetDays: -125, durationDays: 10, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 10 },
  { name: 'Finalize Floor Plan', phase: 'Design & Permits', anchorEvent: 'OPEN_DATE', offsetDays: -115, durationDays: 7, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 11 },
  { name: 'Permit Package Prep', phase: 'Design & Permits', anchorEvent: 'OPEN_DATE', offsetDays: -110, durationDays: 10, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 12 },
  { name: 'Submit Permits', phase: 'Design & Permits', anchorEvent: 'OPEN_DATE', offsetDays: -100, durationDays: 1, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 13 },
  { name: 'Permit Review Loop', phase: 'Design & Permits', anchorEvent: 'OPEN_DATE', offsetDays: -99, durationDays: 30, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 14 },
  { name: 'Permit Approved', phase: 'Design & Permits', anchorEvent: 'OPEN_DATE', offsetDays: -70, durationDays: 0, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', isMilestone: true, order: 15 },

  // Phase 2: Menu & Supply
  { name: 'Draft Menu Selection', phase: 'Menu & Supply', anchorEvent: 'CONTRACT_SIGNED', offsetDays: 60, durationDays: 7, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 16 },
  { name: 'Recipe Testing', phase: 'Menu & Supply', anchorEvent: 'CONTRACT_SIGNED', offsetDays: 67, durationDays: 10, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 17 },
  { name: 'Menu Costing', phase: 'Menu & Supply', anchorEvent: 'CONTRACT_SIGNED', offsetDays: 77, durationDays: 7, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 18 },
  { name: 'Finalize Menu', phase: 'Menu & Supply', anchorEvent: 'CONTRACT_SIGNED', offsetDays: 84, durationDays: 1, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 19 },
  { name: 'Select Key Suppliers', phase: 'Menu & Supply', anchorEvent: 'CONTRACT_SIGNED', offsetDays: 85, durationDays: 7, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 20 },
  { name: 'Set Up Vendor Accounts', phase: 'Menu & Supply', anchorEvent: 'CONTRACT_SIGNED', offsetDays: 92, durationDays: 7, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 21 },

  // Phase 3: Equipment
  { name: 'Equipment List Draft', phase: 'Equipment', anchorEvent: 'OPEN_DATE', offsetDays: -120, durationDays: 5, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 22 },
  { name: 'Request Quotes', phase: 'Equipment', anchorEvent: 'OPEN_DATE', offsetDays: -115, durationDays: 7, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 23 },
  { name: 'Select Equipment Vendors', phase: 'Equipment', anchorEvent: 'OPEN_DATE', offsetDays: -108, durationDays: 3, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 24 },
  { name: 'Place Equipment Orders', phase: 'Equipment', anchorEvent: 'OPEN_DATE', offsetDays: -105, durationDays: 2, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 25 },
  { name: 'Confirm Delivery Windows', phase: 'Equipment', anchorEvent: 'OPEN_DATE', offsetDays: -90, durationDays: 2, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 26 },

  // Phase 4: Construction
  { name: 'Construction Start', phase: 'Construction', anchorEvent: 'OPEN_DATE', offsetDays: -90, durationDays: 0, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', isMilestone: true, order: 27 },
  { name: 'GC Selection / Contract', phase: 'Construction', anchorEvent: 'OPEN_DATE', offsetDays: -105, durationDays: 10, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 28 },
  { name: 'Construction Kickoff', phase: 'Construction', anchorEvent: 'CONSTRUCTION_START', offsetDays: 0, durationDays: 1, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 29 },
  { name: 'Demolition / Prep', phase: 'Construction', anchorEvent: 'CONSTRUCTION_START', offsetDays: 1, durationDays: 5, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 30 },
  { name: 'Framing & Rough-in MEP', phase: 'Construction', anchorEvent: 'CONSTRUCTION_START', offsetDays: 6, durationDays: 20, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 31 },
  { name: 'Rough-in Inspections', phase: 'Construction', anchorEvent: 'CONSTRUCTION_START', offsetDays: 22, durationDays: 3, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 32 },
  { name: 'Drywall / Finishes', phase: 'Construction', anchorEvent: 'CONSTRUCTION_START', offsetDays: 25, durationDays: 20, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 33 },
  { name: 'Signage Install Plan', phase: 'Construction', anchorEvent: 'OPEN_DATE', offsetDays: -45, durationDays: 10, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 34 },
  { name: 'Equipment Install', phase: 'Construction', anchorEvent: 'OPEN_DATE', offsetDays: -28, durationDays: 7, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 35 },
  { name: 'Final Clean', phase: 'Construction', anchorEvent: 'OPEN_DATE', offsetDays: -5, durationDays: 2, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 36 },

  // Phase 5: IT & Systems
  { name: 'Select POS', phase: 'IT & Systems', anchorEvent: 'OPEN_DATE', offsetDays: -90, durationDays: 7, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'IT', order: 37 },
  { name: 'Order POS Hardware', phase: 'IT & Systems', anchorEvent: 'OPEN_DATE', offsetDays: -80, durationDays: 3, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'IT', order: 38 },
  { name: 'Install Network', phase: 'IT & Systems', anchorEvent: 'OPEN_DATE', offsetDays: -21, durationDays: 2, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'IT', order: 39 },
  { name: 'Configure POS', phase: 'IT & Systems', anchorEvent: 'OPEN_DATE', offsetDays: -14, durationDays: 7, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'IT', order: 40 },

  // Phase 6: Licensing
  { name: 'Business License App', phase: 'Licensing', anchorEvent: 'OPEN_DATE', offsetDays: -60, durationDays: 10, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 41 },
  { name: 'Health Inspection', phase: 'Licensing', anchorEvent: 'OPEN_DATE', offsetDays: -14, durationDays: 1, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 42 },
  { name: 'Business License Issued', phase: 'Licensing', anchorEvent: 'OPEN_DATE', offsetDays: -3, durationDays: 0, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', isMilestone: true, order: 43 },

  // Phase 7: Hiring & Training
  { name: 'Hire Store Manager', phase: 'Hiring & Training', anchorEvent: 'OPEN_DATE', offsetDays: -60, durationDays: 14, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 44 },
  { name: 'Hire Crew', phase: 'Hiring & Training', anchorEvent: 'OPEN_DATE', offsetDays: -30, durationDays: 14, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 45 },
  { name: 'Training Day 1', phase: 'Hiring & Training', anchorEvent: 'OPEN_DATE', offsetDays: -10, durationDays: 1, workdayRule: 'BUSINESS_DAYS_MON_FRI', roleResponsible: 'PM', order: 46 },
  { name: 'Training Day 2', phase: 'Hiring & Training', anchorEvent: 'OPEN_DATE', offsetDays: -9, durationDays: 1, workdayRule: 'BUSINESS_DAYS_MON_FRI', roleResponsible: 'PM', order: 47 },
  { name: 'Training Day 3', phase: 'Hiring & Training', anchorEvent: 'OPEN_DATE', offsetDays: -8, durationDays: 1, workdayRule: 'BUSINESS_DAYS_MON_FRI', roleResponsible: 'PM', order: 48 },
  { name: 'Training Day 4', phase: 'Hiring & Training', anchorEvent: 'OPEN_DATE', offsetDays: -7, durationDays: 1, workdayRule: 'BUSINESS_DAYS_MON_FRI', roleResponsible: 'PM', order: 49 },
  { name: 'Training Day 5', phase: 'Hiring & Training', anchorEvent: 'OPEN_DATE', offsetDays: -6, durationDays: 1, workdayRule: 'BUSINESS_DAYS_MON_FRI', roleResponsible: 'PM', order: 50 },

  // Phase 8: Opening
  { name: 'Soft Open', phase: 'Opening', anchorEvent: 'OPEN_DATE', offsetDays: -3, durationDays: 0, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', isMilestone: true, order: 51 },
  { name: 'Soft Opening Day 1', phase: 'Opening', anchorEvent: 'OPEN_DATE', offsetDays: -3, durationDays: 1, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 52 },
  { name: 'Grand Open', phase: 'Opening', anchorEvent: 'OPEN_DATE', offsetDays: 0, durationDays: 0, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', isMilestone: true, order: 53 },
  { name: 'Grand Opening Execution', phase: 'Opening', anchorEvent: 'OPEN_DATE', offsetDays: 0, durationDays: 1, workdayRule: 'CALENDAR_DAYS', roleResponsible: 'PM', order: 54 },
];

// Generate tasks for a store based on anchor dates
export interface AnchorDates {
  OPEN_DATE: Date;
  CONTRACT_SIGNED?: Date;
  CONSTRUCTION_START?: Date;
}

export interface GeneratedTask {
  title: string;
  phase: string;
  startDate: Date;
  dueDate: Date;
  status: string;
  priority: string;
  sourceType: string;
  calendarRule: string;
  anchor: string;
  isMilestone: boolean;
  roleResponsible?: string;
  order: number;
}

export function generateStoreTimeline(
  anchorDates: AnchorDates,
  templateTasks: TemplateTaskDef[] = DEFAULT_TEMPLATE_TASKS
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  
  // Derive missing anchor dates if possible
  const anchors: Record<string, Date> = {
    OPEN_DATE: anchorDates.OPEN_DATE,
  };
  
  // CONTRACT_SIGNED is typically 180 days before OPEN_DATE
  if (anchorDates.CONTRACT_SIGNED) {
    anchors.CONTRACT_SIGNED = anchorDates.CONTRACT_SIGNED;
  } else {
    anchors.CONTRACT_SIGNED = addDays(anchorDates.OPEN_DATE, -180);
  }
  
  // CONSTRUCTION_START is typically 90 days before OPEN_DATE
  if (anchorDates.CONSTRUCTION_START) {
    anchors.CONSTRUCTION_START = anchorDates.CONSTRUCTION_START;
  } else {
    anchors.CONSTRUCTION_START = addDays(anchorDates.OPEN_DATE, -90);
  }
  
  for (const template of templateTasks) {
    const anchorDate = anchors[template.anchorEvent] || anchors.OPEN_DATE;
    
    const startDate = calculateDate(anchorDate, template.offsetDays, template.workdayRule);
    const dueDate = calculateDate(startDate, template.durationDays, template.workdayRule);
    
    tasks.push({
      title: template.name,
      phase: template.phase,
      startDate,
      dueDate,
      status: 'NOT_STARTED',
      priority: template.isMilestone ? 'HIGH' : 'MEDIUM',
      sourceType: 'TEMPLATE',
      calendarRule: template.workdayRule,
      anchor: template.anchorEvent,
      isMilestone: template.isMilestone || false,
      roleResponsible: template.roleResponsible,
      order: template.order,
    });
  }
  
  // Sort by start date
  tasks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  
  return tasks;
}

// Reschedule tasks when anchor date changes
export function rescheduleTasksOnAnchorChange(
  tasks: GeneratedTask[],
  oldAnchorDate: Date,
  newAnchorDate: Date,
  anchorType: string
): GeneratedTask[] {
  const deltaDays = differenceInCalendarDays(newAnchorDate, oldAnchorDate);
  
  if (deltaDays === 0) return tasks;
  
  return tasks.map(task => {
    // Only reschedule tasks anchored to the changed anchor
    if (task.anchor !== anchorType) return task;
    
    return {
      ...task,
      startDate: addDays(task.startDate, deltaDays),
      dueDate: addDays(task.dueDate, deltaDays),
    };
  });
}
