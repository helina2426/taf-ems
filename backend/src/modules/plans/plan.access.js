// WHO may see and change a plan. Used by the plan and KPI services.
//
//                 Holding plan            Company plan                 Employee plan
//   Writes it     Holding users           that company's Manager       that company's Manager
//   Makes it      Head / approver         Head / approver approves     the Manager activates,
//   ACTIVE        activates it            (or returns it)              the employee acknowledges
//   Can see it    everyone (read only)    Holding + that Manager       Holding + that Manager
//                                                                      + the employee (once ACTIVE)
//
// The company wall: a Manager's company always comes from the database (req.user.companyId),
// never from the request, so a Manager can never reach another company's plans by changing an id.

import { AppError } from '../../shared/AppError.js';

export const EDITABLE = ['DRAFT', 'RETURNED'];

export function isApprover(user) {
  return user.role === 'HOLDING' && (user.isPrimaryHoldingUser || user.canApproveEvaluations);
}

// Is this user the one who writes this plan?
export function isWriter(user, plan) {
  if (plan.level === 'HOLDING') return user.role === 'HOLDING';
  return user.role === 'MANAGER' && Boolean(user.companyId) && user.companyId === plan.companyId;
}

export function canView(user, plan) {
  if (user.role === 'HOLDING') return true;
  if (user.role === 'MANAGER') return plan.level === 'HOLDING' || plan.companyId === user.companyId;
  return plan.level === 'INDIVIDUAL' && plan.employeeId === user.employeeId && plan.status === 'ACTIVE';
}

export function assertCanView(user, plan) {
  if (canView(user, plan)) return;
  if (user.role === 'EMPLOYEE' && plan.employeeId === user.employeeId) {
    throw AppError.forbidden('Your plan is not ready yet. Your Manager will share it with you.');
  }
  throw AppError.forbidden();
}

// Can this user change the plan (its KPIs) right now?
export function assertCanWrite(user, plan) {
  if (!isWriter(user, plan)) {
    assertCanView(user, plan);
    throw AppError.forbidden('Only the person who writes this plan can change it.');
  }
  if (plan.cycle.status === 'CLOSED') throw AppError.conflict('This plan year is closed.');
  if (!EDITABLE.includes(plan.status)) {
    throw AppError.conflict(
      plan.status === 'SUBMITTED'
        ? 'This plan is waiting for approval and cannot be changed. It can be changed again if it is returned.'
        : 'This plan is active and cannot be changed any more.',
    );
  }
}

// May this user see which KPIs of the level below are linked to the plan's KPIs?
// (A Manager must not see the KPIs of other companies linked to the Holding plan.)
export function canSeeLinked(user, plan) {
  if (user.role === 'HOLDING') return true;
  return user.role === 'MANAGER' && plan.level === 'COMPANY' && plan.companyId === user.companyId;
}

// The buttons this user may use on this plan, so the screen and the server always agree.
export function allowedActions(user, plan) {
  const open = plan.cycle.status !== 'CLOSED';
  const writer = isWriter(user, plan);
  const editable = open && writer && EDITABLE.includes(plan.status);
  return {
    edit: editable,
    submit: editable && plan.level === 'COMPANY',
    activate: editable && (plan.level === 'INDIVIDUAL' || (plan.level === 'HOLDING' && isApprover(user))),
    approve: open && plan.level === 'COMPANY' && plan.status === 'SUBMITTED' && isApprover(user),
    return: open && plan.level === 'COMPANY' && plan.status === 'SUBMITTED' && isApprover(user),
    acknowledge: plan.level === 'INDIVIDUAL' && plan.status === 'ACTIVE' && !plan.acknowledgedAt && user.employeeId === plan.employeeId && user.role === 'EMPLOYEE',
    delete: open && ((writer && EDITABLE.includes(plan.status)) || (plan.status === 'ACTIVE' && user.role === 'HOLDING' && user.isPrimaryHoldingUser)),
  };
}
