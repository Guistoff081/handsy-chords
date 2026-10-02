// What the person should read for each state of the live input. Failures explain how to fix them.
export const INPUT_MESSAGES = {
  requesting: "Permita o uso do microfone no navegador.",
  denied: "Microfone bloqueado. Libere o acesso nas permissões do site e ative de novo.",
  nodevice: "Nenhum microfone encontrado. Conecte um e ative de novo.",
  unsupported: "Este navegador não libera o microfone aqui. Use HTTPS ou localhost.",
  error: "O microfone parou de responder. Ative de novo.",
};

export const INPUT_FAILURES = ["denied", "nodevice", "unsupported", "error"];

export const CAMERA_MESSAGES = {
  requesting: "Permita o uso da câmera no navegador.",
  loading: "Carregando o modelo de mão (cerca de 8 MB, só na primeira vez).",
  denied: "Câmera bloqueada. Libere o acesso nas permissões do site e ative de novo.",
  nodevice: "Nenhuma câmera encontrada. Conecte uma e ative de novo.",
  unsupported: "Este navegador não libera a câmera aqui. Use HTTPS ou localhost.",
  error: "Não foi possível iniciar o rastreamento da mão. Verifique a conexão e ative de novo.",
};
