export * from './enums';
export * from './core.entities';
export * from './record.entities';
export * from './ops.entities';

import { HealthProfile, ServiceItem, TherapistProfile, User } from './core.entities';
import {
  Course,
  Dispatch,
  RecordItem,
  RiskAssessment,
  ServiceRecord,
  Visit,
} from './record.entities';
import { ExceptionEvent, FollowUp, Referral, Settlement } from './ops.entities';

export const ALL_ENTITIES = [
  User,
  HealthProfile,
  TherapistProfile,
  ServiceItem,
  Course,
  ServiceRecord,
  RecordItem,
  RiskAssessment,
  Dispatch,
  Visit,
  ExceptionEvent,
  Settlement,
  FollowUp,
  Referral,
];
