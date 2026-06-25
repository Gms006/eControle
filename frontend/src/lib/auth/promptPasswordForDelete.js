export function promptPasswordForDelete() {
  const password = window.prompt("Confirme sua senha para prosseguir com a exclusão:");
  if (password === null) return null;
  const trimmed = String(password || "").trim();
  if (!trimmed) throw new Error("Senha obrigatória para confirmar a exclusão.");
  return trimmed;
}
