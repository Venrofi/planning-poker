export interface CountdownState {
  isActive: boolean,
  startedAt: string | null,
  startedBy: string | null
}

export interface ResetState {
  isActive: boolean,
  initiatedAt: string | null,
  initiatedBy: string | null
}
