import time, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("models/kokoro-v1.0.onnx", "models/voices-v1.0.bin")
print([v for v in k.get_voices() if v.startswith("h")])
texts = {
 "roman": "Haan... yeh akelapan bahut bhaari lagta hai na. Kya hua, aaj sabse zyada akela kyun lag raha hai?",
 "deva":  "हाँ... यह अकेलापन बहुत भारी लगता है ना. क्या हुआ, आज सबसे ज़्यादा अकेला क्यों लग रहा है?",
 "mixed": "हम्म... रात के तीन बज गए और नींद नहीं आ रही. क्या mind कहीं और भाग रहा है?",
}
for voice in ["hf_alpha","hf_beta"]:
    for name,t in texts.items():
        for lang in (["hi"] if name!="roman" else ["hi","en-us"]):
            s=time.time()
            try:
                a,sr = k.create(t, voice=voice, speed=0.92, lang=lang)
            except Exception as e:
                print(voice,name,lang,"ERR",e); continue
            f=f"samples/{voice}_{name}_{lang}.wav"; sf.write(f,a,sr)
            print(f"{f}: {len(a)/sr:.1f}s audio in {time.time()-s:.2f}s")
