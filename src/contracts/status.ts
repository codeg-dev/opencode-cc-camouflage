export type SupportStatus = 'supported' | 'unsupported'

export type PeerStatus = 'present' | 'missing'

export type EmulatorStatus = 'present' | 'missing' | 'unreachable'

export type PatchStatus = 'clean' | 'drift' | 'incompatible'

export type InstallMode = 'local-folder' | 'cache' | 'unknown'

export interface StatusContract {
  peer: PeerStatus
  emulator: EmulatorStatus
  patch: PatchStatus
  install_mode: InstallMode
  support: SupportStatus
}
