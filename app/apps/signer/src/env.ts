export type Env = {
  /** Ed25519 private key as JWK JSON ({kty:"OKP",crv:"Ed25519",d,x}). Worker secret only. */
  SIGNING_KEY_ED25519_JWK?: string;
};
