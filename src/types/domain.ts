export type AppRole = 'owner' | 'admin' | 'viewer';
export type RecordSource = 'manual' | 'bot_booking' | 'walk_in_bot' | 'import' | 'system';
export type WelcomeStatus = 'not_requested' | 'pending' | 'sent' | 'failed' | 'skipped';
export type PaymentMethod = 'cash' | 'nequi' | 'daviplata' | 'card' | 'transfer' | 'other';
export type TransactionStatus = 'active' | 'voided';

export interface Profile {
  user_id: string;
  full_name: string;
  role: AppRole;
  active: boolean;
}

export interface Barber {
  id: string;
  name: string;
  aliases: string[];
  active: boolean;
  sort_order: number;
  calendar_external_id: string | null;
  telegram_chat_id: string | null;
  phone_e164: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  code: string;
  name: string;
  aliases: string[];
  category: string;
  price: number;
  duration_minutes: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  email: string | null;
  document_id: string | null;
  birth_date: string | null;
  address: string | null;
  whatsapp_opt_in: boolean;
  whatsapp_opt_in_at: string | null;
  welcome_status: WelcomeStatus;
  welcome_sent_at: string | null;
  source: RecordSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInput {
  full_name: string;
  phone_e164: string;
  email?: string;
  document_id?: string;
  birth_date?: string;
  address?: string;
  whatsapp_opt_in: boolean;
  notes?: string;
}

export interface ServiceTransaction {
  id: string;
  client_id: string;
  barber_id: string;
  service_id: string;
  amount: number;
  payment_method: PaymentMethod;
  occurred_at: string;
  status: TransactionStatus;
  source: RecordSource;
  notes: string | null;
  barber_name_snapshot: string;
  service_name_snapshot: string;
  service_category_snapshot: string;
  created_at: string;
  client?: Pick<Client, 'id' | 'full_name' | 'phone_e164'>;
  barber?: Pick<Barber, 'id' | 'name' | 'color'>;
  service?: Pick<Service, 'id' | 'name' | 'category'>;
}

export interface RegisterCutInput {
  clientId?: string;
  client?: ClientInput;
  barberId: string;
  serviceId: string;
  amount: number;
  occurredAt: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  idempotencyKey: string;
}

export interface RegisterCutResult {
  client_id: string;
  client_created: boolean;
  transaction_id: string;
  transaction_created: boolean;
  welcome_queued: boolean;
}
