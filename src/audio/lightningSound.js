let audioContext;

function disconnect(nodes) {
  nodes.forEach((node) => node.disconnect?.());
}

export async function playLightningSound() {
  const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextConstructor) return false;

  let nodes = [];
  try {
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === "suspended") await audioContext.resume();

    const now = audioContext.currentTime;
    const durationSeconds = 0.65;
    const buffer = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * durationSeconds), audioContext.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;

    const source = audioContext.createBufferSource();
    const highPass = audioContext.createBiquadFilter();
    const lowPass = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    nodes = [source, highPass, lowPass, gain];
    source.buffer = buffer;
    highPass.type = "highpass";
    highPass.frequency.setValueAtTime(900, now);
    lowPass.type = "lowpass";
    lowPass.frequency.setValueAtTime(7_000, now);
    lowPass.frequency.exponentialRampToValueAtTime(700, now + durationSeconds);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
    source.connect(highPass).connect(lowPass).connect(gain).connect(audioContext.destination);
    source.onended = () => disconnect(nodes);
    source.start(now);
    source.stop(now + durationSeconds);
    return true;
  } catch {
    disconnect(nodes);
    return false;
  }
}
