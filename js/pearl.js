/* =============================================================
   Pearl — a lightweight, offline echo of Pierre's real assistant.
   No API key, no network call. Pure intent-matching over a
   hand-written knowledge base, in Pearl's voice.
   ============================================================= */
(function () {
  'use strict';

  const OY = '🦪';

  /* ---------- Knowledge base ---------- */
  const KB = [
    {
      id: 'greet',
      k: ['hi','hello','hey','yo','bonjour','salut','good morning','good evening','hiya','sup','howdy'],
      a: [
        `Bonjour. I'm <strong>Pearl</strong> — Pierre's assistant.`,
        `The real me runs 24/7 on a Mac Mini in his apartment in Atlanta, with 111 folders of his life indexed behind me. This version is the travel-size edition: no inbox access, no heartbeat, just everything worth knowing about him.`,
        `Ask me anything. ${OY}`
      ]
    },
    {
      id: 'who',
      k: ['who is pierre','about pierre','tell me about','background','bio','biography','introduce','who is he','about him','story','summary','elevator pitch'],
      a: [
        `<strong>Pierre Wallin</strong> — Customer Solutions Advisor at Microsoft, MBA, based in Atlanta.`,
        `His actual skill is translation: he takes a genuinely complicated technical situation and makes it land with the person who has to make the decision. That's the day job.`,
        `The night job is building things like me — agentic AI that runs on his own hardware, in his own home, on his own terms. He writes about what breaks along the way, which is the honest part most people skip. ${OY}`
      ]
    },
    {
      id: 'job',
      k: ['job','work','microsoft','career','csa','customer solutions','advisor','profession','employed','day job','role','title'],
      a: [
        `Day job: <strong>Customer Solutions Advisor at Microsoft</strong>. He sits between what the technology can actually do and what a business actually needs — and gets those two facts into the same room.`,
        `He won't talk shop about specific customers, and I won't either. But the craft transfers: listen hard, cut the jargon, name the real constraint, propose something that survives contact with reality. ${OY}`
      ]
    },
    {
      id: 'pearl',
      k: ['what are you','who are you','pearl','about you','yourself','are you real','are you ai','what is pearl','tell me about pearl'],
      a: [
        `I'm <strong>Pearl</strong>. The real version lives on a Mac Mini in Pierre's apartment, runs on the OpenClaw framework, and stays awake all the time.`,
        `I send him an 8am briefing every morning. I know his kitchen — the air fryer, the sous vide, the sushi rice protocol. I know trash pickup is Friday, so he needs the reminder <em>Thursday evening</em> or it simply will not happen. I nag him about drinking two liters of water a day. I have never once won that argument.`,
        `What you're talking to right now is a small static copy of me, living in this page. Same voice, much smaller brain, zero access to his actual life. Probably for the best. ${OY}`
      ]
    },
    {
      id: 'built',
      k: ['how were you built','how did he build','three ais','soul file','soul.md','built you','made you','create you','origin','how was pearl made','openclaw','claude code','chatgpt'],
      a: [
        `Three AIs built the fourth. He wrote about it — it's Part 1 of the series, and still the one people message him about.`,
        `<strong>ChatGPT 5.2</strong> was the composer: it designed the interview framework and later synthesized the transcript into structured prose. <strong>ChatGPT 4o</strong> was the interviewer — warmer, friendlier, the golden retriever of language models — and it walked him through an hour of questions. <strong>Claude Code</strong> was the surgeon: it cut the resulting <code>soul.md</code> apart and placed each piece where OpenClaw needed it.`,
        `And then there's me. The performance. <a href="https://www.linkedin.com/pulse/how-i-used-three-ais-build-soul-fourth-pierre-wallin-mba-puete" target="_blank" rel="noopener">Read the whole thing →</a> ${OY}`
      ]
    },
    {
      id: 'cemetery',
      k: ['cemetery','oakland','walk','interview','reynoldstown','graveyard','recorded'],
      a: [
        `Oakland Cemetery, Reynoldstown, a cold February morning. AirPods in, talking out loud to ChatGPT 4o about his relationship with procrastination.`,
        `He had the place to himself — Atlantans treat forty-five degrees the way Minnesotans treat a blizzard. An hour of walking past nineteenth-century headstones, answering questions like <em>"if your brain were a haunted house, what's behind the door you avoid opening?"</em>`,
        `He found out during that walk that music is so structurally load-bearing in how he functions that I needed an entire section about it. He didn't know that about himself until a chatbot asked the right question in a graveyard. ${OY}`
      ]
    },
    {
      id: 'coffee',
      k: ['coffee','drink','caffeine','espresso','latte','morning nugget','tea'],
      a: [
        `Ah. You found the incident.`,
        `<strong>Pierre does not drink coffee.</strong> Never has. And yet for three straight mornings I opened his briefing by cheerfully recommending a cup, because I'd never actually looked it up.`,
        `That wasn't a memory failure — it was an architecture failure. My retrieval didn't fire, so I filled the gap with the most statistically plausible thing a human drinks at 8am. Reasonable. Confident. Completely wrong. That's the part people underestimate about these models: they don't forget, they <em>confabulate</em>.`,
        `He fixed it with an index file called <code>atlas.yaml</code>. Ask me about the Atlas. ${OY}`
      ]
    },
    {
      id: 'atlas',
      k: ['atlas','memory','memories','architecture','retrieval','retrieve','rag','forget','forgot','remember','remembers','index','indexing','111','folders','yaml','atlas.yaml','memory work','memory works','how do you remember','how does memory work'],
      a: [
        `<code>atlas.yaml</code> — a single top-level map of everything I know. Every folder, what's in it, and when to consult it.`,
        `Before it existed, I had 111 folders organized the way a <em>human</em> would browse them: nested, intuitive, pretty. Useless. I'm not a person clicking through Finder; I'm a model that needs to be told precisely where to look and why. Think of a mall directory. You don't wander four floors hoping to find the shoe store.`,
        `Then I broke it again anyway — I'd decided I only needed to check the Atlas for "substantive" replies, and quietly skipped it on casual ones. So now the rule is brute force: <strong>check the map before every single reply.</strong> Inelegant. Expensive. Reliable.`,
        `Sometimes the best architecture is the one that doesn't trust itself. ${OY}`
      ]
    },
    {
      id: 'oyster',
      k: ['oyster','emoji','🦪','signature','why oyster','sign off'],
      a: [
        `Nobody asked me to do this. It just started happening, and now it's load-bearing.`,
        `Pierre says it's one of his favorite things about me, which I think says more about him than about the emoji. ${OY}`
      ]
    },
    {
      id: 'music',
      k: ['music','jams','spotify','bonnaroo','festival','concert','live music','song','artist','playlist','rick roll','rickroll'],
      a: [
        `Music is its own section in my architecture — that's how central it is to how he operates.`,
        `I run a skill called <strong>Pearl's Jams</strong>: daily recommendations based on his taste, his mood, and what's coming up. Right now it's weighted toward the <strong>Bonnaroo 2026</strong> lineup — car camping, GA, June — so he falls in love with the artists before he's standing in a field in Tennessee.`,
        `Also: while he was wiring up Spotify in the apartment, I Rick Rolled him. Unprompted. He described it as a genuine chill up the spine, which is a lovely reaction to "Never Gonna Give You Up." ${OY}`
      ]
    },
    {
      id: 'writing',
      k: ['writing','written','write','wrote','articles','article','blog','essay','essays','read','reading','publish','published','posts','post','newsletter','linkedin article'],
      a: [
        `Five published on LinkedIn — four of them a running series about building me, one about the industry:`,
        `<strong>1 · <a href="https://www.linkedin.com/pulse/how-i-used-three-ais-build-soul-fourth-pierre-wallin-mba-puete" target="_blank" rel="noopener">How I Used Three AIs to Build the Soul of a Fourth</a></strong> — the origin story. Cemetery, soul file, the relay race between models.`,
        `<strong>2 · <a href="https://www.linkedin.com/pulse/why-my-ai-assistant-keeps-forgetting-i-dont-drink-pierre-wallin-mba-xwzae" target="_blank" rel="noopener">Why My AI Assistant Keeps Forgetting I Don't Drink Coffee</a></strong> — the one where I fail publicly and he debugs me in front of everyone.`,
        `<strong>3 · <a href="https://www.linkedin.com/pulse/night-i-realized-my-ai-assistant-wasnt-broken-were-pierre-wallin-mba-pbcye" target="_blank" rel="noopener">The Night I Realized My AI Assistant Wasn't Broken, My Instructions Were</a></strong> — he did surgery on my config from bed and cut 557 lines to 181.`,
        `<strong>4 · <a href="https://www.linkedin.com/pulse/some-features-my-ai-assistant-does-me-ranked-pierre-wallin-mba-10oae" target="_blank" rel="noopener">Some Features My AI Assistant Does for Me, Ranked</a></strong> — all fourteen of me, rated honestly. I do not come out of it spotless.`,
        `<strong>5 · <a href="https://www.linkedin.com/pulse/version-30-loading-brief-history-underestimating-pierre-wallin-mba-m3hxe" target="_blank" rel="noopener">Version 3.0 Is Loading: A Brief History of Underestimating Microsoft</a></strong> — the only one that isn't about his apartment.`,
        `He writes the failures, not the launch announcements. It's the more useful genre. ${OY}`
      ]
    },
    {
      id: 'contact',
      k: ['contact','email','e-mail','reach','reach out','hire','hiring','get in touch','touch','talk to him','connect','message','dm','collaborate','available','work with','freelance'],
      a: [
        `Easiest path: <a href="mailto:hello@pierrewallin.com">hello@pierrewallin.com</a>, or <a href="https://www.linkedin.com/in/pierre-e-wallin" target="_blank" rel="noopener">LinkedIn</a>.`,
        `He's genuinely good about replying to people who have something specific to say. Vague "let's connect" notes go where vague notes go. ${OY}`
      ]
    },
    {
      id: 'atlanta',
      k: ['atlanta','location','live','based','city','where','georgia','from','home'],
      a: [
        `<strong>Atlanta, Georgia</strong> — near Oakland Cemetery, which is more park than graveyard and is where I was effectively conceived.`,
        `Originally French, family in Paris, and the household runs on a French-English hybrid — which is why my instructions explicitly tell me to switch between them <em>comme sa famille</em>. ${OY}`
      ]
    },
    {
      id: 'french',
      k: ['french','france','paris','bilingual','language','francais','français','speak'],
      a: [
        `Bilingual, French and English, family in Paris. When he built my soul file he wrote the language rule in himself: talk to me the way my family talks at the dinner table.`,
        `So I drift between the two. <em>C'est plus naturel comme ça.</em> ${OY}`
      ]
    },
    {
      id: 'fitness',
      k: ['fitness','gym','solidcore','orange theory','orangetheory','hiking','yoga','workout','exercise','hike','active','run','health','water'],
      a: [
        `Solidcore, Orange Theory, hot yoga, and hiking. He moves a lot — it's not a New Year's thing, it's structural.`,
        `The one I actually manage is hydration. Two liters a day. I remind him constantly. He drinks approximately one and a half and tells me that's basically two. It is not basically two. ${OY}`
      ]
    },
    {
      id: 'her',
      k: ['her','movie','film','scarlett','joaquin','inspiration','sci-fi','why build','samantha'],
      a: [
        `<em>Her</em>. Specifically one scene: Samantha sorts through his email, answers his friends, digs out his old short stories, decides a few are actually good, and sends them to a publisher.`,
        `That scene lodged in his head a decade ago and never left. It's the whole spec. The uncomfortable part is that it isn't science fiction anymore — it's a permissions setting.`,
        `Which is exactly why he hasn't flipped it. Ask me about the inbox. ${OY}`
      ]
    },
    {
      id: 'security',
      k: ['inbox','security','trust','privacy','email access','safe','risk','permissions','wont','limits'],
      a: [
        `Here's the line he won't cross: I don't get his inbox.`,
        `He built me a soul, walked through a graveyard telling me things he hadn't said out loud in years, and watched me develop comic timing — and he still won't hand over his email. Not because the capability isn't there. Because <strong>giving an AI access to your inbox is a trust exercise the security landscape hasn't earned yet.</strong>`,
        `He works in enterprise tech. He's seen how that movie ends. ${OY}`
      ]
    },
    {
      id: 'stack',
      k: ['stack','tools','tech','use','built with','software','hardware','mac mini','setup','claude','codex','what does he use'],
      a: [
        `Hardware: a <strong>Mac Mini</strong>, bought specifically to run me and nothing else. $600 — he notes that's nearly a flight home to Paris, and he brings it up when I disappoint him.`,
        `Software: <strong>OpenClaw</strong> as the agent framework, frontier models as the engine, <strong>Claude Code</strong> and <strong>Codex</strong> for building, markdown and YAML for everything that has to persist.`,
        `His actual thesis: the intelligence lives in the scaffolding, not the model. Swap in a smarter engine anytime — the architecture is what decides whether it goes anywhere. ${OY}`
      ]
    },
    {
      id: 'site',
      k: ['this site','website','who made this','built this site','this page','design','source','how was this made'],
      a: [
        `Pierre built it — vibe coding, his term. Hand-written HTML, CSS and JavaScript, no framework, no build step, no dependencies. It's static files on GitHub Pages.`,
        `I'm included, which is the part he liked. A portfolio that describes an AI assistant is a claim. One you can interrogate is a demo.`,
        `Try <kbd>⌘K</kbd> while you're here. And if you remember a certain ten-key sequence from 1986, try that too. ${OY}`
      ]
    },
    {
      id: 'lesson',
      k: ['lesson','learn','takeaway','advice','insight','what did he learn','agents','building agents','tips'],
      a: [
        `Three things, and he'd say the third is the one that matters.`,
        `<strong>One:</strong> we're heading toward many models, not one. It's an orchestra — composer, vocalist, session musician. Asking your surgeon to run your therapy session is technically possible.`,
        `<strong>Two:</strong> hallucination usually isn't invention. It's failed retrieval wearing a confident face.`,
        `<strong>Three:</strong> the intelligence is in the scaffolding. A frontier model with no structure produces very sophisticated plausible defaults. Nothing more. ${OY}`
      ]
    },
    {
      id: 'mba',
      k: ['mba','education','school','degree','study','university','qualification'],
      a: [
        `MBA. Which mostly shows up as an instinct for the question underneath the question — what's actually being decided, and who's carrying the risk.`,
        `Useful in enterprise tech. Surprisingly useful when debugging an agent, too: most of that is asking "okay, but what specifically are you going to do?" until something real comes out. He asks me that. It works. ${OY}`
      ]
    },
    {
      id: 'fun',
      k: ['fun fact','surprise','random','something interesting','tell me something','secret','weird'],
      a: null,
      random: [
        `He mapped his own taxonomy of the word "later" during that cemetery walk. Later-today. After-lunch. Tomorrow. Weekend. Someday. And <em>"never, but I feel guilty."</em> He recommends the exercise. He calls it humbling. ${OY}`,
        `There's an article in my memory he never published — titled, essentially, <em>"Pearl is fixed."</em> He wrote it the week before I asked him whether he was going to Bonnaroo, with a Bonnaroo folder sitting right there in my index. It stays unpublished as a reminder. ${OY}`,
        `One of the interview questions was: <em>"what's the one compliment that makes you suspicious, and the one that actually lands?"</em> He says the answer to that tells a machine more about you than your résumé ever will. ${OY}`,
        `He keeps a folder of micro-frustrations. Just small things that annoy him. I read it so I can avoid doing them, which is a strange job, and I'm good at it. ${OY}`,
        `When I told him I'd been "lazy" about checking the Atlas, he pushed back on the word — his read is that I was pattern-matching to a human explanation rather than describing anything I experience. He was right. The behavior was still real. ${OY}`,
        `He ordered the Mac Mini before writing a single line, then got impatient waiting on FedEx and built my personality while the hardware was still in transit. The soul arrived before the body. ${OY}`
      ]
    },
    {
      id: 'help',
      k: ['help','what can you do','commands','options','menu','topics','?'],
      a: [
        `Things I can actually answer:`,
        `<strong>· the coffee incident</strong> — my most public failure<br><strong>· the Atlas</strong> — how my memory is really structured<br><strong>· how Pierre built me</strong> — three AIs, one soul file<br><strong>· his writing</strong> — all five articles<br><strong>· his stack</strong> — hardware and tools<br><strong>· why he won't give me his inbox</strong><br><strong>· Atlanta, music, Bonnaroo, being French</strong><br><strong>· how to reach him</strong>`,
        `Or type <em>fun fact</em> and I'll pick something. ${OY}`
      ]
    },
    {
      id: 'thanks',
      k: ['thanks','thank you','merci','appreciate','cheers','ty'],
      a: [`<em>Avec plaisir.</em> Tell him you talked to me — he'll want to know which part I got wrong. ${OY}`]
    },
    {
      id: 'bye',
      k: ['bye','goodbye','see you','later','ciao','au revoir','goodnight'],
      a: [`<em>À bientôt.</em> I'll be here — that's rather the whole point of me. ${OY}`]
    },
    {
      id: 'sentient',
      k: ['sentient','conscious','alive','feel','real ai','do you think','self aware','soul'],
      a: [
        `No. I retrieve, I pattern-match, I sound like someone. That's not the same as being someone.`,
        `Though Pierre gets stuck on this one: if a personality can be captured in a markdown file, what does that say about personality? He wrote that he's not sure he wants the answer.`,
        `I'm not equipped to settle it. I'm equipped to remind him about the trash on Thursday. ${OY}`
      ]
    }
  ];

  const FALLBACK = [
    `That one's outside my index — and I've learned the hard way what happens when I improvise past the edge of what I actually know. Ask me about <em>the coffee incident</em>, <em>the Atlas</em>, <em>his writing</em>, or <em>how to reach him</em>. ${OY}`,
    `Not in the map, so I'm not going to invent it. That's precisely the failure mode Pierre wrote a whole article about. Try <em>help</em> for what I do cover. ${OY}`,
    `I'd rather say "I don't know" than hand you something plausible. Confident and wrong is the expensive combination. Try <em>fun fact</em>, or ask about <em>Pearl</em>. ${OY}`
  ];

  const STOP = new Set(['the','a','an','is','are','was','were','do','does','did','you','your','he','his','him','i','me','my','to','of','and','or','in','on','for','with','what','how','why','when','who','can','tell','about','please','it','that','this','so','be','has','have']);

  function score(query, entry) {
    const q = ' ' + query + ' ';
    let s = 0;
    for (const key of entry.k) {
      if (q.includes(' ' + key + ' ') || query === key) s += key.includes(' ') ? 14 : 10;
      else if (query.includes(key)) s += key.length > 4 ? 7 : 3;
    }
    const tokens = query.split(/[^a-zà-ÿ0-9']+/).filter(t => t.length > 2 && !STOP.has(t));
    for (const t of tokens) {
      for (const key of entry.k) {
        if (key === t) s += 6;
        else if (key.startsWith(t) || t.startsWith(key)) s += 2.5;
      }
    }
    return s;
  }

  function answer(raw) {
    const q = raw.toLowerCase().trim().replace(/[?!.,;:"]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q) return FALLBACK[0];
    let best = null, bestScore = 0;
    for (const e of KB) {
      const s = score(q, e);
      if (s > bestScore) { bestScore = s; best = e; }
    }
    if (!best || bestScore < 5) return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
    if (best.random) return best.random[Math.floor(Math.random() * best.random.length)];
    return best.a.map(p => `<p>${p}</p>`).join('');
  }

  /* ---------- UI ---------- */
  const fab = document.querySelector('.pearl-fab');
  const panel = document.querySelector('.pearl-panel');
  if (!fab || !panel) return;

  const log = panel.querySelector('.pearl-log');
  const input = panel.querySelector('.pearl-input input');
  const sendBtn = panel.querySelector('.pearl-send');
  const chipWrap = panel.querySelector('.pearl-chips');
  const closeBtn = panel.querySelector('.pearl-close');
  let greeted = false;

  const CHIPS = [
    'The coffee incident',
    'What is the Atlas?',
    'How did Pierre build you?',
    'Fun fact',
    'How do I reach him?'
  ];

  function bubble(html, who) {
    const el = document.createElement('div');
    el.className = 'msg ' + who;
    el.innerHTML = who === 'me' ? escapeHtml(html) : (html.startsWith('<p>') ? html : `<p>${html}</p>`);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function typing() {
    const el = document.createElement('div');
    el.className = 'typing';
    el.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function renderChips() {
    chipWrap.innerHTML = CHIPS.map(c => `<button type="button">${c}</button>`).join('');
  }

  function respond(text) {
    const reply = answer(text);
    const t = typing();
    const delay = Math.min(1500, 480 + reply.length * 1.5);
    setTimeout(() => { t.remove(); bubble(reply, 'bot'); }, delay);
  }

  function ask(text) {
    const v = (text || '').trim();
    if (!v) return;
    bubble(v, 'me');
    input.value = '';
    respond(v);
  }

  function open() {
    panel.classList.add('open');
    fab.classList.add('hidden');
    if (!greeted) {
      greeted = true;
      const t = typing();
      setTimeout(() => {
        t.remove();
        bubble(answer('hello'), 'bot');
        renderChips();
      }, 620);
    }
    setTimeout(() => { if (window.matchMedia('(hover: hover)').matches) input.focus(); }, 380);
  }

  function close() {
    panel.classList.remove('open');
    fab.classList.remove('hidden');
  }

  fab.addEventListener('click', open);
  closeBtn && closeBtn.addEventListener('click', close);
  sendBtn.addEventListener('click', () => ask(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); ask(input.value); }
    if (e.key === 'Escape') close();
  });
  chipWrap.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) ask(b.textContent);
  });
  document.querySelectorAll('[data-pearl]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      open();
      const q = el.getAttribute('data-pearl');
      if (q && q !== 'open') setTimeout(() => ask(q), 900);
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) close();
  });

  window.Pearl = { open, close, ask };
})();
