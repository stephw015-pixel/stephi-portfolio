// portfolio-tweaks.jsx
// Three expressive tweaks for Stephanie's portfolio:
//   1. Mood     — palette/atmosphere (Studio / Warm / Editorial / Midnight)
//   2. Voice    — display typography (Bold / Soft serif italic / Mono)
//   3. Spectrum — the rainbow gradient on hero "magic" + contact title
//                 (Sunset / Ocean / Ember / Mono)
//
// Each control rewires CSS variables / data attributes on <html>, so a single
// switch reshapes the whole page rather than nudging one property.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mood": "studio",
  "voice": "bold",
  "spectrum": "sunset"
}/*EDITMODE-END*/;

function PortfolioTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    const root = document.documentElement;
    // 'studio' is the default — clear the attribute so :root vars apply.
    if (t.mood && t.mood !== 'studio') root.setAttribute('data-mood', t.mood);
    else root.removeAttribute('data-mood');

    if (t.voice && t.voice !== 'bold') root.setAttribute('data-voice', t.voice);
    else root.removeAttribute('data-voice');

    if (t.spectrum && t.spectrum !== 'sunset') root.setAttribute('data-spectrum', t.spectrum);
    else root.removeAttribute('data-spectrum');
  }, [t.mood, t.voice, t.spectrum]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Mood" />
      <TweakRadio
        label="Atmosphere"
        value={t.mood}
        options={[
          { value: 'studio',    label: 'Studio' },
          { value: 'warm',      label: 'Warm' },
          { value: 'editorial', label: 'Paper' },
          { value: 'midnight',  label: 'Night' },
        ]}
        onChange={(v) => setTweak('mood', v)}
      />

      <TweakSection label="Voice" />
      <TweakRadio
        label="Display type"
        value={t.voice}
        options={[
          { value: 'bold', label: 'Bold' },
          { value: 'soft', label: 'Soft' },
          { value: 'mono', label: 'Mono' },
        ]}
        onChange={(v) => setTweak('voice', v)}
      />

      <TweakSection label="Spectrum" />
      <TweakRadio
        label="Accent"
        value={t.spectrum}
        options={[
          { value: 'sunset', label: 'Sunset' },
          { value: 'ocean',  label: 'Ocean' },
          { value: 'ember',  label: 'Ember' },
          { value: 'mono',   label: 'Mono' },
        ]}
        onChange={(v) => setTweak('spectrum', v)}
      />
    </TweaksPanel>
  );
}

const __twkRoot = document.getElementById('tweaks-root');
if (__twkRoot) ReactDOM.createRoot(__twkRoot).render(<PortfolioTweaks />);
