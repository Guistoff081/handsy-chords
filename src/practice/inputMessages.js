// What the person should read for each state of the live input. Failures explain how to fix them.
export const INPUT_MESSAGES = {
  requesting: "Permita o uso do microfone no navegador.",
  denied: "Microfone bloqueado. Libere o acesso nas permissões do site e ative de novo.",
  nodevice: "Nenhum microfone encontrado. Conecte um e ative de novo.",
  unsupported: "Este navegador não libera o microfone aqui. Use HTTPS ou localhost.",
  error: "O microfone parou de responder. Ative de novo.",
};

export const INPUT_FAILURES = ["denied", "nodevice", "unsupported", "error"];
