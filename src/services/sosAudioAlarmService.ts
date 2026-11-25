/**
 * Dịch vụ phát âm thanh còi báo động khẩn cấp SOS bằng HTML5 Audio API (`HTMLAudioElement` với `loop = true`)
 * kết hợp Web Audio API (`AudioContext`) để:
 *  1. Tự động tổng hợp file âm thanh còi hú khẩn cấp 2 tần số (Dual-Tone Emergency Siren WAV) ngay trong bộ nhớ,
 *     đảm bảo luôn phát được 100% mà không phụ thuộc file MP3 ngoại vi.
 *  2. Tự động mở khóa (unlock) AudioContext & HTML5 Audio ngay từ lần click / chạm đầu tiên của người dùng trên trang.
 *  3. Bắt ngoại lệ `NotAllowedError` khi trình duyệt chặn Autoplay để hiển thị nút nhắc người dùng bật tiếng còi.
 */

let sirenAudioElement: HTMLAudioElement | null = null;
let audioCtxInstance: AudioContext | null = null;
let sirenWavUrl: string | null = null;
let isAudioUnlocked = false;
let globalUnlockRegistered = false;

/**
 * Tạo chuỗi WAV Data URL cho tiếng còi báo động khẩn cấp (chu kỳ 1.2 giây lặp lại mượt mà: 850Hz <-> 1350Hz)
 */
function buildEmergencySirenWavUrl(): string {
  if (sirenWavUrl) return sirenWavUrl;

  const sampleRate = 22050;
  const durationSeconds = 1.2;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // WAV Header (PCM 16-bit Mono)
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Tạo sóng âm còi hú khẩn cấp (Frequency modulation + overtone)
  let phase = 0;
  let overtonePhase = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = t / durationSeconds;

    // Quét tần số lên xuống mượt mà từ 780 Hz đến 1380 Hz
    const sweep = 0.5 - 0.5 * Math.cos(2 * Math.PI * progress);
    const freq = 780 + 600 * sweep;

    phase += (2 * Math.PI * freq) / sampleRate;
    overtonePhase += (2 * Math.PI * (freq * 1.5)) / sampleRate;

    // Kết hợp sóng sin cơ bản và họa âm bậc 2 tạo âm sắc còi báo động rõ ràng
    const rawSample = 0.72 * Math.sin(phase) + 0.22 * Math.sin(overtonePhase);

    // Envelope nhẹ ở 2 đầu chu kỳ để khi loop = true không bị tiếng click
    let envelope = 1.0;
    if (t < 0.03) {
      envelope = t / 0.03;
    } else if (t > durationSeconds - 0.03) {
      envelope = (durationSeconds - t) / 0.03;
    }

    const clamped = Math.max(-1, Math.min(1, rawSample * envelope * 0.45));
    view.setInt16(44 + i * 2, Math.floor(clamped * 32767), true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  sirenWavUrl = URL.createObjectURL(blob);
  return sirenWavUrl;
}

function getOrCreateAudioElement(): HTMLAudioElement {
  if (!sirenAudioElement) {
    const url = buildEmergencySirenWavUrl();
    const audio = new Audio(url);
    audio.loop = true; // Lặp lại liên tục (loop) theo yêu cầu
    audio.preload = 'auto';
    audio.volume = 0.85;
    sirenAudioElement = audio;
  }
  return sirenAudioElement;
}

/**
 * Mở khóa sẵn AudioContext và HTML5 AudioElement ngay ở lần tương tác (click/tap/keypress) đầu tiên của user
 */
export function registerGlobalAudioUnlock(onUnlocked?: () => void): () => void {
  const unlockHandler = () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (AudioContextClass && !audioCtxInstance) {
        audioCtxInstance = new AudioContextClass();
      }
      if (audioCtxInstance && audioCtxInstance.state === 'suspended') {
        audioCtxInstance.resume().catch(() => {});
      }

      const audio = getOrCreateAudioElement();
      if (!isAudioUnlocked && audio.paused) {
        // Phát thử ở mức âm lượng 0 trong 1 frame để trình duyệt cấp quyền Autoplay cho element này
        const prevVol = audio.volume;
        audio.volume = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              audio.volume = prevVol;
              isAudioUnlocked = true;
              onUnlocked?.();
            })
            .catch(() => {
              audio.volume = prevVol;
            });
        }
      } else {
        isAudioUnlocked = true;
        onUnlocked?.();
      }
    } catch {
      // Ignore audio unlock error
    }
  };

  if (!globalUnlockRegistered && typeof window !== 'undefined') {
    globalUnlockRegistered = true;
    window.addEventListener('pointerdown', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
    window.addEventListener('touchstart', unlockHandler, { passive: true });
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
      window.removeEventListener('touchstart', unlockHandler);
      globalUnlockRegistered = false;
    }
  };
}

/**
 * Bắt đầu phát âm thanh còi báo động lặp lại (loop).
 * Trả về `{ playing: true, autoplayBlocked: false }` nếu phát thành công,
 * hoặc `{ playing: false, autoplayBlocked: true }` nếu trình duyệt chặn Autoplay.
 */
export async function startSosSirenAlarm(): Promise<{
  playing: boolean;
  autoplayBlocked: boolean;
}> {
  try {
    if (audioCtxInstance && audioCtxInstance.state === 'suspended') {
      await audioCtxInstance.resume().catch(() => {});
    }

    const audio = getOrCreateAudioElement();
    audio.loop = true;
    audio.volume = 0.85;

    await audio.play();
    isAudioUnlocked = true;
    return { playing: true, autoplayBlocked: false };
  } catch {
    // Ngoại lệ khi trình duyệt chặn Autoplay (NotAllowedError) trước khi user tương tác với trang
    return { playing: false, autoplayBlocked: true };
  }
}

/**
 * Dừng ngay tiếng còi báo động và đưa về vị trí đầu
 */
export function stopSosSirenAlarm(): void {
  try {
    if (sirenAudioElement) {
      sirenAudioElement.pause();
      sirenAudioElement.currentTime = 0;
    }
  } catch {
    // Ignore stop error
  }
}
