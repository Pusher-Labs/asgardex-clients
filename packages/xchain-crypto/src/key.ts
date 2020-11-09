export interface PrivKey {
  getPubKey(): PubKey | null
  toBuffer(): Buffer
  toBase64(): string
  sign(message: Buffer): Buffer
}

export interface PubKey {
  getAddress(): Buffer
  toBuffer(): Buffer
  toBase64(): string
  verify(signature: Buffer, message?: Buffer): boolean
}
