export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = "Permintaan tidak dapat diproses.",
  ) {
    super(message);
    this.name = "DomainError";
  }
}
