import { useMemo, useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, ChevronRight, CircleHelp, FileText, KeyRound, Laptop, Search, ShieldCheck, Wifi } from "lucide-react";

type Topic = { title: string; terms: string; steps: string[]; expected: string; recovery: string };
const topics: Topic[] = [
  {
    title: "Save and reopen a local draft",
    terms: "save local vault passphrase reopen restore draft",
    steps: ["Select Save locally. Create a passphrase if this is your first save.", "Later, select Unlock saved work on this device and enter that passphrase."],
    expected: "The last successful save is encrypted on this device only. It is not uploaded.",
    recovery: "If the local save fails, keep the page open and retry. Do not close or refresh until you know a save succeeded.",
  },
  {
    title: "Understand record status",
    terms: "unsaved edits local saved device pending not uploaded server confirmed online",
    steps: ["Unsaved edits exist only on screen.", "Saved locally means the last save is on this device.", "Pending means not uploaded and not server-confirmed.", "Server-confirmed means the service explicitly confirmed the record."],
    expected: "Connection status is separate from record status. Online does not mean submitted.",
    recovery: "Upload is unavailable here. Do not treat a local or pending record as submitted.",
  },
  {
    title: "Leave an edited shift sheet",
    terms: "leave navigate shift sheet report unsaved warning stay",
    steps: ["Save the draft locally before leaving, or stay on the page and finish your edits.", "If warned, choose Stay and keep working to return to the sheet."],
    expected: "Leaving without saving does not keep edits that are still on screen.",
    recovery: "If you already left, reopen the last successful local draft. Unsaved edits cannot be restored.",
  },
  {
    title: "Account activation",
    terms: "sign in account access invitation activation",
    steps: ["Sign in with your approved staff account.", "Activation is invitation-only; there is no self-service sign-up."],
    expected: "An invitation is required before account access is available.",
    recovery: "If you do not have an invitation or cannot sign in, follow your established department process.",
  },
];

const librarySources = [
  { label: "Ohio Revised Code", source: "Ohio Laws · official statutory text captured November 19, 2026", url: "https://codes.ohio.gov/ohio-revised-code" },
  { label: "Columbus City Code", source: "Columbus Code of Ordinances · official source reader", url: "https://library.municode.com/oh/columbus/codes/code_of_ordinances" },
  { label: "Ohio Public Defender Criminal Law Casebook", source: "Official source reader", url: "https://opd.ohio.gov/law-library/criminal-law-casebook/criminal-law-casebook" },
  { label: "Ohio Public Defender Legal Glossary", source: "Official source reader", url: "https://opd.ohio.gov/law-library/glossary-of-legal-terms" },
  { label: "Oyez Supreme Court cases", source: "Official source reader", url: "https://www.oyez.org/" },
];
const scopeRows = [
  ["Shared shell & status", "Keep connection, unsaved, local-save, pending, and server-confirmed states distinct. Move explanation to Help."],
  ["Sign-in & account access", "Keep the approved-account sign-in title and invitation-only activation message; no self-service sign-up."],
  ["Help & Resources", "Keep search and source names. Separate application-use guidance from sourced operational material."],
  ["Reports & forms", "Keep field labels, required markers, concise validation, and clear save state. Move longer field guidance to Help."],
  ["Assignments", "Keep assignment, phase, and next action visible; move process explanations to Help."],
  ["Packet review", "Retain server-confirmed status and consequential warnings. Do not merge or redesign packet controls."],
  ["Empty & error states", "State what is unavailable and one recovery action. Put extended troubleshooting in Help."],
  ["Dialogs & warnings", "Lead with the consequence and a clear safe choice, especially for unsaved work and irreversible actions."],
  ["Packet-upload screen reference", "Shorten the reference to user-facing save and upload status. Keep upload controls separate and outside this copy proposal."],
];

export function CopyReviewPreview() {
  const [query, setQuery] = useState("");
  const [activeTitle, setActiveTitle] = useState(topics[0].title);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return topics.filter(topic => !needle || `${topic.title} ${topic.terms} ${topic.steps.join(" ")} ${topic.expected} ${topic.recovery}`.toLocaleLowerCase().includes(needle));
  }, [query]);
  const active = matches.find(topic => topic.title === activeTitle) ?? matches[0];
  const showTopic = (title: string) => setActiveTitle(title);

  return <main className="cpa">
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap');
      .cpa{--cpa-navy:#103a63;--cpa-navy-dark:#0d2d4e;--cpa-blue:#004d87;--cpa-red:#c42332;--cpa-ink:#263746;--cpa-muted:#5d6872;--cpa-line:#ccd1d5;--cpa-paper:#f1f2f3;--cpa-white:#fff;min-height:100dvh;background:var(--cpa-paper);color:var(--cpa-ink);font:14px/1.5 Arial,Helvetica,sans-serif}
      .cpa *{box-sizing:border-box}.cpa button,.cpa input,.cpa textarea,.cpa select{font:inherit}.cpa button:disabled{cursor:not-allowed}
      .cpa-review-banner{position:relative;display:flex;justify-content:center;align-items:center;gap:9px;min-height:34px;padding:7px 14px;border-top:3px solid var(--cpa-red);background:#e9eaeb;color:#27323b;text-align:center;font-size:12px;font-weight:700}
      .cpa-review-banner small{font:700 10px/1.2 Arial,Helvetica,sans-serif;letter-spacing:.08em;color:#5b6268}
      .cpa-masthead{background:var(--cpa-navy-dark);color:white;box-shadow:0 2px 4px #142b3e2b}
      .cpa-mast-inner{width:min(100%,1180px);margin:auto;padding:13px 24px 10px}
      .cpa-logos{display:grid;grid-template-columns:minmax(160px,1fr) minmax(260px,1.5fr) minmax(150px,1fr);align-items:center;gap:clamp(12px,2.2vw,30px);min-height:94px}
      .cpa-city{width:min(100%,290px);max-height:57px;justify-self:start;object-fit:contain}
      .cpa-titlebar{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;min-width:0;text-align:center}
      .cpa-insignia{display:flex;justify-content:flex-end;align-items:center;gap:10px;min-width:0}
      .cpa-badge,.cpa-patch{height:78px;max-width:calc(50% - 5px);object-fit:contain}
      .cpa-division{font-size:13px;font-weight:700;letter-spacing:.055em;text-transform:uppercase}
      .cpa-portal-name{font-size:15px;font-weight:700;letter-spacing:.025em}
      .cpa-review-id{color:#d7e2ee;font-size:9px;font-weight:700;letter-spacing:.055em}
      .cpa-nav{background:var(--cpa-blue);color:#fff;border-top:1px solid #ffffff2c}
      .cpa-nav-inner{width:min(100%,1180px);min-height:48px;margin:auto;padding:0 24px;display:flex;align-items:stretch;gap:clamp(13px,2.3vw,30px)}
      .cpa-nav-item{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 4px;border-bottom:3px solid transparent;color:#fff;text-decoration:none;font-size:13px;font-weight:700;white-space:nowrap;opacity:.9}
      .cpa-nav-item.active{border-bottom-color:var(--cpa-red);opacity:1}
      .cpa-nav-item svg{width:15px;height:15px}
      .cpa-connection{border-bottom:1px solid var(--cpa-line);background:#fff}
      .cpa-connection-inner{width:min(100%,1180px);margin:auto;padding:8px 24px;display:flex;align-items:center;justify-content:flex-end;gap:15px;color:#384a58;font-size:11px}
      .cpa-connection-state{display:inline-flex;align-items:center;gap:6px;font-weight:700}.cpa-connection-note{color:#64717b}
      .cpa-page{width:min(100%,1180px);margin:auto;padding:24px 24px 52px}
      .cpa-crumb{display:flex;align-items:center;gap:7px;color:#5b6771;font-size:11px;margin-bottom:12px}.cpa-crumb strong{color:var(--cpa-ink)}
      .cpa-page-title{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:18px}
      .cpa-page-title h1{margin:0;color:var(--cpa-navy);font:600 clamp(28px,3.5vw,36px)/1.14 Oswald,Arial,sans-serif;letter-spacing:.015em}
      .cpa-page-title p{margin:5px 0 0;color:var(--cpa-muted);font-size:13px}
      .cpa-preview-pill{flex:none;display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid #d5bd83;background:#fff9e9;color:#614e23;font-size:10px;font-weight:700}
      .cpa-searchbar{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid var(--cpa-line);border-left:4px solid var(--cpa-blue);background:#fff}
      .cpa-searchbox{position:relative;flex:1;min-width:0}.cpa-searchbox svg{position:absolute;top:50%;left:12px;transform:translateY(-50%);color:#536a7c}
      .cpa-searchbox input{width:100%;min-height:43px;padding:8px 12px 8px 39px;border:1px solid #aeb8c0;border-radius:3px;background:#fff;color:#243746;outline:none}
      .cpa-searchbox input:focus{border-color:var(--cpa-blue);box-shadow:0 0 0 3px #004d871c}
      .cpa-search-count{flex:none;color:#52616d;font-size:11px;font-weight:700;white-space:nowrap}
      .cpa-content-grid{display:grid;grid-template-columns:minmax(0,1.85fr) minmax(265px,.85fr);gap:16px;margin-top:14px;align-items:start}
      .cpa-panel{border:1px solid var(--cpa-line);background:var(--cpa-white)}
      .cpa-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 15px;border-bottom:1px solid var(--cpa-line);background:#e8eaec}
      .cpa-panel-head h2{margin:0;color:#263e54;font:600 19px/1.2 Oswald,Arial,sans-serif;letter-spacing:.02em}
      .cpa-panel-head small{color:#58646e;font-size:10px;font-weight:700}
      .cpa-guidance-layout{display:grid;grid-template-columns:minmax(190px,.76fr) minmax(0,1.55fr);min-height:335px}
      .cpa-topic-list{padding:11px;border-right:1px solid var(--cpa-line);background:#f8f9fa}
      .cpa-overline{margin:0 5px 7px;color:#596873;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
      .cpa-topic{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:39px;margin:2px 0;padding:8px 9px;border:1px solid transparent;border-radius:2px;background:transparent;color:#35495a;text-align:left;font-size:12px;font-weight:700}
      .cpa-topic:hover{background:#edf1f4}.cpa-topic.active{border-color:#bcc9d4;border-left:3px solid var(--cpa-red);background:#e4ebf1;color:#173e61}
      .cpa-topic svg{flex:none;width:13px;height:13px;color:#5e7181}
      .cpa-topic-empty{padding:10px;color:var(--cpa-muted);font-size:12px}
      .cpa-answer{padding:17px 18px}
      .cpa-answer-title{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:11px;border-bottom:1px solid #e1e4e6}
      .cpa-answer-title h3{margin:0;color:#183f62;font:600 21px/1.22 Oswald,Arial,sans-serif}
      .cpa-guidance-label{flex:none;padding:4px 7px;border:1px solid #aebdca;background:#f1f5f8;color:#435d71;font-size:9px;font-weight:700;letter-spacing:.04em}
      .cpa-answer-parts{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
      .cpa-answer-part{padding:10px;border:1px solid #dfe3e6;background:#fafbfc}
      .cpa-answer-part.wide{grid-column:1/-1}
      .cpa-answer-part h4{margin:0 0 5px;color:#495d6d;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.055em}
      .cpa-answer-part p,.cpa-answer-part ol{margin:0;color:#354653;font-size:11px;line-height:1.5}
      .cpa-answer-part ol{padding-left:17px}.cpa-answer-part li+li{margin-top:3px}
      .cpa-app-note{margin-top:11px;padding-top:9px;border-top:1px solid #e0e4e7;color:#55636d;font-size:10px;line-height:1.45}
      .cpa-app-note strong{color:#2a4963}
      .cpa-library{overflow:hidden}
      .cpa-library-body{padding:13px}
      .cpa-source-kind{display:block;margin:0 0 9px;color:#5c6770;font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
      .cpa-source-lead{padding:10px;border:1px solid #d6dce0;border-left:3px solid var(--cpa-blue);background:#f8f9fa;margin-bottom:11px}
      .cpa-source-lead strong{display:block;color:#173f62;font-size:12px}
      .cpa-source-lead span{display:block;margin-top:4px;color:#4e5c67;font-size:10px;line-height:1.45}
      .cpa-source-lead a{color:var(--cpa-blue);font-weight:700;text-decoration:underline;text-underline-offset:2px}
      .cpa-library-list{display:grid;gap:6px}
      .cpa-library-link{display:flex;justify-content:space-between;align-items:center;gap:9px;min-height:36px;padding:7px 9px;border:1px solid #dfe3e6;background:#fff;color:#284c69;text-decoration:none;font-size:10px;font-weight:700}
      .cpa-library-link:hover{background:#eef3f7;text-decoration:underline}
      .cpa-library-link svg{flex:none;width:12px;height:12px}
      .cpa-source-disclaimer{margin:11px 0 0;padding:9px;background:#f0f1f2;color:#58636c;font-size:9px;line-height:1.45}
      .cpa-section{margin-top:24px}
      .cpa-section-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:10px}
      .cpa-section-heading h2{margin:0;color:#153d60;font:600 23px/1.15 Oswald,Arial,sans-serif;letter-spacing:.02em}
      .cpa-section-heading p{margin:4px 0 0;color:#596670;font-size:11px}
      .cpa-section-kicker{color:#52626e;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      .cpa-copy-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:14px}
      .cpa-copy-card{border:1px solid var(--cpa-line);background:#fff}
      .cpa-copy-card h3{margin:0;padding:11px 13px;border-bottom:1px solid var(--cpa-line);background:#e9ebed;color:#263f55;font-size:12px}
      .cpa-copy-card-body{padding:13px}
      .cpa-state-row{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid #e8eaec;font-size:10px;line-height:1.45}
      .cpa-state-row:last-of-type{border-bottom:0}
      .cpa-state-name{display:flex;gap:7px;align-items:flex-start;color:#254b6c;font-weight:700}
      .cpa-state-name svg{flex:none;width:13px;height:13px;margin-top:1px}
      .cpa-state-copy{color:#354550}
      .cpa-status-warning{margin-top:10px;padding:9px 10px;border:1px solid #dec58c;background:#fff8e8;color:#594a2a;font-size:10px;line-height:1.45}
      .cpa-unsaved{margin-top:9px;padding:9px 10px;border:1px solid #dbb8b2;border-left:3px solid #b23a31;background:#fbf3f2;color:#63352f;font-size:10px;line-height:1.45}
      .cpa-unsaved strong{display:block;margin-bottom:2px}
      .cpa-failed{display:flex;align-items:flex-start;gap:8px;margin-top:9px;padding:9px 10px;border:1px solid #dbb8b2;background:#fbf3f2;color:#643a34;font-size:10px;line-height:1.45}
      .cpa-failed svg{flex:none;width:14px;height:14px}
      .cpa-signin{display:grid;grid-template-columns:1fr 1fr;gap:11px;padding:14px}
      .cpa-signin h4{margin:0;color:#1b4162;font:600 19px/1.2 Oswald,Arial,sans-serif}
      .cpa-signin p{margin:5px 0 11px;color:#465763;font-size:11px}
      .cpa-signin label{display:block;color:#435361;font-size:10px;font-weight:700}
      .cpa-signin input{width:100%;min-height:39px;margin-top:5px;padding:8px;border:1px solid #b9c1c7;background:#f4f5f6;color:#5f6870}
      .cpa-disabled-action{width:100%;min-height:38px;margin-top:9px;border:1px solid #8898a6;background:#e6e9ec;color:#5a6670;font-size:11px;font-weight:700}
      .cpa-activation{padding:12px;border:1px solid #d3d9de;background:#f3f5f6;color:#344957;font-size:10px;line-height:1.5}
      .cpa-activation strong{display:block;margin-bottom:5px;color:#183f60;font-size:11px}
      .cpa-activation p{margin:0}
      .cpa-form{border:1px solid var(--cpa-line);background:#fff}
      .cpa-form-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 15px;border-bottom:1px solid var(--cpa-line);background:#e9ebed}
      .cpa-form-head h3{margin:0;color:#1a4164;font:600 21px/1.2 Oswald,Arial,sans-serif}
      .cpa-fictitious{color:#634e25;font-size:9px;font-weight:700;letter-spacing:.07em}
      .cpa-form-body{padding:15px}
      .cpa-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .cpa-field{min-width:0}.cpa-field.wide{grid-column:1/-1}
      .cpa-field label{display:block;margin-bottom:4px;color:#334857;font-size:11px;font-weight:700}
      .cpa-required{color:#a51f2d}
      .cpa-field input,.cpa-field select,.cpa-field textarea{width:100%;min-height:40px;padding:8px 10px;border:1px solid #aeb8c0;border-radius:2px;background:#fff;color:#33424e;font-size:12px}
      .cpa-field textarea{min-height:66px;resize:vertical}
      .cpa-field input::placeholder,.cpa-field textarea::placeholder{color:#73808a}
      .cpa-rating-options{display:flex;flex-wrap:wrap;gap:7px}
      .cpa-rating{display:inline-flex;min-width:48px;min-height:34px;align-items:center;justify-content:center;border:1px solid #9eabb5;background:#f4f5f6;color:#183f60;font-size:12px;font-weight:700}
      .cpa-rating.selected{border-color:#1b4e77;background:#e6edf3;box-shadow:inset 0 -2px 0 var(--cpa-red)}
      .cpa-validation{margin:12px 0 0;padding:9px 11px;border-left:3px solid #a21f2d;background:#f7e9e9;color:#6e232b;font-size:11px;font-weight:700}
      .cpa-form-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:11px;border-top:1px solid #dfe3e6}
      .cpa-form-footer button{min-height:38px;padding:8px 13px;border:1px solid #788795;background:#e6e8ea;color:#55616a;font-size:11px;font-weight:700}
      .cpa-form-footer span{color:#495963;font-size:10px}
      .cpa-context-help{margin:11px 0 0;color:#4b5963;font-size:10px}
      .cpa-context-help button{padding:0;border:0;background:none;color:var(--cpa-blue);text-decoration:underline;text-underline-offset:2px;font-size:10px;font-weight:700}
      .cpa-scope{border:1px solid var(--cpa-line);background:#fff}
      .cpa-scope-row{display:grid;grid-template-columns:minmax(155px,.4fr) minmax(0,1fr);gap:14px;padding:9px 12px;border-bottom:1px solid #e2e5e7}
      .cpa-scope-row:last-child{border-bottom:0}
      .cpa-scope-row strong{color:#244866;font-size:10px}
      .cpa-scope-row span{color:#4c5b66;font-size:10px;line-height:1.45}
      .cpa-footer-note{margin-top:16px;padding:11px 13px;border-left:3px solid var(--cpa-red);background:#e8eaec;color:#49555f;font-size:10px;line-height:1.5}
      .cpa-footer-note strong{color:#253a4b}
      @media(max-width:820px){
        .cpa-content-grid{grid-template-columns:1fr}
        .cpa-library-list{grid-template-columns:repeat(2,minmax(0,1fr))}
        .cpa-mast-inner,.cpa-nav-inner,.cpa-connection-inner{padding-left:16px;padding-right:16px}
      }
      @media(max-width:620px){
        .cpa-review-banner{font-size:10px;flex-wrap:wrap;gap:4px 7px}
        .cpa-review-banner small{width:100%}
        .cpa-mast-inner{padding:10px 12px 8px}
        .cpa-logos{grid-template-columns:minmax(82px,.9fr) minmax(145px,1.45fr) minmax(76px,.8fr);gap:6px;min-height:66px}
        .cpa-city{max-height:39px}
        .cpa-titlebar{gap:2px}
        .cpa-division{font-size:8px;letter-spacing:.02em}.cpa-portal-name{font-size:10px;line-height:1.25}
        .cpa-insignia{gap:2px}
        .cpa-badge,.cpa-patch{height:48px;max-width:calc(50% - 1px)}
        .cpa-review-id{margin-top:2px;font-size:7px}
        .cpa-nav-inner{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;padding:0 6px}
        .cpa-nav-item{justify-content:center;flex-direction:column;gap:2px;min-width:0;min-height:55px;height:55px;padding:3px 2px;font-size:9px;text-align:center;white-space:normal}
        .cpa-nav-item svg{width:14px;height:14px}
        .cpa-connection-inner{justify-content:flex-start;flex-wrap:wrap;gap:6px 12px;font-size:10px}
        .cpa-page{padding:17px 12px 36px}
        .cpa-page-title{align-items:flex-start;flex-direction:column;gap:9px}
        .cpa-page-title h1{font-size:30px}
        .cpa-preview-pill{font-size:9px}
        .cpa-searchbar{align-items:stretch;flex-direction:column;gap:7px;padding:9px}
        .cpa-search-count{text-align:right}
        .cpa-guidance-layout{grid-template-columns:1fr}
        .cpa-topic-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px;border-right:0;border-bottom:1px solid var(--cpa-line)}
        .cpa-overline{grid-column:1/-1}
        .cpa-topic{min-height:42px;font-size:10px}
        .cpa-answer{padding:13px}
        .cpa-answer-title h3{font-size:19px}
        .cpa-answer-parts{grid-template-columns:1fr}
        .cpa-answer-part.wide{grid-column:auto}
        .cpa-library-list{grid-template-columns:1fr}
        .cpa-copy-grid,.cpa-signin{grid-template-columns:1fr}
        .cpa-state-row{grid-template-columns:1fr;gap:3px}
        .cpa-form-head{align-items:flex-start}
        .cpa-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .cpa-field.wide{grid-column:1/-1}
        .cpa-form-footer{align-items:flex-start;flex-direction:column}
        .cpa-scope-row{grid-template-columns:1fr;gap:3px}
        .cpa-section-heading{align-items:flex-start;flex-direction:column}
      }
      @media(max-width:360px){.cpa-topic-list{grid-template-columns:1fr}.cpa-form-grid{grid-template-columns:1fr}.cpa-field.wide{grid-column:auto}}
      @media(prefers-reduced-motion:reduce){.cpa *{scroll-behavior:auto!important;transition:none!important}}
    `}</style>

    <div className="cpa-review-banner">
      <ShieldCheck size={14} aria-hidden="true"/>
      <span>FICTIONAL APPROVAL PREVIEW · COPY PROPOSAL ONLY · NOT A LIVE PORTAL OR OFFICIAL ENDORSEMENT</span>
    </div>
    <header className="cpa-masthead">
      <div className="cpa-mast-inner">
        <div className="cpa-logos" aria-label="Columbus Division of Police identity">
          <img className="cpa-city" src="/__mockup/images/columbus-portal/columbus-logo.svg" alt="The City of Columbus"/>
          <div className="cpa-titlebar"><span className="cpa-division">Division of Police</span><span className="cpa-portal-name">Field Training Officer Portal</span><span className="cpa-review-id">COPY-AUDIT-01 · REVIEW ONLY</span></div>
          <div className="cpa-insignia"><img className="cpa-badge" src="/__mockup/images/columbus-portal/silver-police-badge.png" alt="Silver Columbus Police badge"/><img className="cpa-patch" src="/__mockup/images/columbus-portal/columbus-police-patch-white-eagle.png" alt="Columbus Police patch with white eagle"/></div>
        </div>
      </div>
      <nav className="cpa-nav" aria-label="Portal navigation preview">
        <div className="cpa-nav-inner">
          <span className="cpa-nav-item"><FileText/>Daily Records</span>
          <span className="cpa-nav-item"><FileText/>Assignments</span>
          <span className="cpa-nav-item"><BookOpen/>Resources</span>
          <span className="cpa-nav-item active" aria-current="page"><CircleHelp/>Help Desk</span>
        </div>
      </nav>
    </header>
    <div className="cpa-page">
      <div className="cpa-crumb"><span>Resources</span><ChevronRight size={12}/><strong>Help Desk</strong></div>
      <header className="cpa-page-title">
        <div><h1>Help Desk</h1><p>Search practical portal guidance, or browse manuals, forms, and directives in Resources.</p></div>
      </header>

      <section aria-label="Search application-use guidance">
        <div className="cpa-searchbar" id="application-search">
          <label className="cpa-searchbox"><Search size={17}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search saving, account access, shift sheets…" aria-label="Search Help Desk topics"/></label>
          <span className="cpa-search-count" role="status">{matches.length} {matches.length===1?"topic":"topics"}</span>
        </div>
        <div className="cpa-content-grid">
          <section className="cpa-panel" aria-label="Application-use Help Desk">
            <div className="cpa-panel-head"><h2>Application-use help</h2><small>Portal steps · not policy</small></div>
            <div className="cpa-guidance-layout">
              <nav className="cpa-topic-list" aria-label="Help topics">
                <p className="cpa-overline">Common tasks</p>
                {matches.map(topic=><button type="button" key={topic.title} className={`cpa-topic ${active?.title===topic.title?"active":""}`} onClick={()=>showTopic(topic.title)} aria-pressed={active?.title===topic.title}>{topic.title}<ChevronRight aria-hidden="true"/></button>)}
                {!matches.length&&<p className="cpa-topic-empty">No matching topics. Try “save”, “status”, or “account”.</p>}
              </nav>
              <article className="cpa-answer" aria-live="polite">
                {active?<><div className="cpa-answer-title"><h3>{active.title}</h3><span className="cpa-guidance-label">APPLICATION USE · NOT POLICY</span></div>
                  <div className="cpa-answer-parts">
                    <section className="cpa-answer-part"><h4>Steps</h4><ol>{active.steps.map(step=><li key={step}>{step}</li>)}</ol></section>
                    <section className="cpa-answer-part"><h4>Expected result</h4><p>{active.expected}</p></section>
                    <section className="cpa-answer-part wide"><h4>Recovery</h4><p>{active.recovery}</p></section>
                  </div>
                  <p className="cpa-app-note"><strong>Application-use guidance.</strong> For operational requirements, check the applicable official source in the existing Resources / Law Library.</p>
                </>:<div><h3>No matching Help Desk topic</h3><p>Clear the search or try a shorter term.</p></div>}
              </article>
            </div>
          </section>

          <aside className="cpa-panel cpa-library" aria-labelledby="library-title">
            <div className="cpa-panel-head"><h2 id="library-title">Resources / Law Library</h2><small>Existing sources</small></div>
            <div className="cpa-library-body">
              <span className="cpa-source-kind">Official operational source</span>
              <div className="cpa-source-lead"><strong>FTO Manual</strong><span>Source: Final FTO Manual · updated 03/10/2026</span></div>
              <div className="cpa-source-lead"><strong>Columbus Division of Police Directives</strong><span>Directive PDF index · checked 11/19/2026</span><span><a href="https://www.columbus.gov/Services/Public-Safety/Police/About-the-Columbus-Division-of-Police/Directives" target="_blank" rel="noreferrer">Open the official directive index</a></span></div>
              <span className="cpa-source-kind">Existing searchable Law Library sources</span>
              <div className="cpa-library-list">{librarySources.map(source=><a className="cpa-library-link" key={source.label} href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.label}</strong><br/><span style={{fontWeight:400,color:"#5c6770"}}>{source.source}</span></span><ChevronRight aria-hidden="true"/></a>)}</div>
              <p className="cpa-source-disclaimer">Forms & guidance: Substation Orientation form · U-10.181, page 1; Reporting for Duty form · U-10.191, page 1.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="cpa-section" aria-labelledby="shared-status-title">
        <div className="cpa-section-heading"><div><h2 id="shared-status-title">Shared status & save copy</h2><p>Visible status says what happened without implying submission.</p></div><span className="cpa-section-kicker">Copy proposal</span></div>
        <div className="cpa-copy-grid">
          <article className="cpa-copy-card"><h3>Record and connection status</h3><div className="cpa-copy-card-body">
            <div className="cpa-state-row"><span className="cpa-state-name"><AlertTriangle/>Unsaved edits</span><span className="cpa-state-copy"><b>Unsaved edits are not saved.</b> They remain on screen only.</span></div>
            <div className="cpa-state-row"><span className="cpa-state-name"><Laptop/>Saved locally</span><span className="cpa-state-copy"><b>Saved on this device.</b> This local draft is not uploaded.</span></div>
            <div className="cpa-state-row"><span className="cpa-state-name"><FileText/>Pending</span><span className="cpa-state-copy"><b>Not uploaded.</b> No server confirmation is available.</span></div>
            <div className="cpa-state-row"><span className="cpa-state-name"><CheckCircle2/>Server-confirmed</span><span className="cpa-state-copy"><b>Server confirmation received.</b> The service explicitly confirmed this record.</span></div>
            <div className="cpa-state-row"><span className="cpa-state-name"><Wifi/>Connection</span><span className="cpa-state-copy"><b>Online</b> or <b>Offline</b> describes connection status only. It does not confirm a save or submission.</span></div>
            <div className="cpa-status-warning"><b>Packet upload is unavailable here.</b> A local save is not a submission.</div>
            <div className="cpa-unsaved"><strong>Unsaved work warning</strong>Keep this page open until a local save succeeds. Leaving now will not keep edits that have not been saved.</div>
          </div></article>
          <article className="cpa-copy-card"><h3>Failed local save</h3><div className="cpa-copy-card-body"><div className="cpa-failed"><AlertTriangle aria-hidden="true"/><span><b>Local save failed.</b> Your on-screen changes are not stored. Keep this page open and retry the local save before leaving.</span></div></div></article>
        </div>
      </section>

      <section className="cpa-section" aria-labelledby="sign-in-title">
        <div className="cpa-section-heading"><div><h2 id="sign-in-title">Sign-in & account access</h2><p>Use your approved staff account. Account activation is invitation-only.</p></div><span className="cpa-section-kicker">Fictional sample</span></div>
        <div className="cpa-copy-card">
          <div className="cpa-signin">
            <div><h4>Sign in to Field Training Officer Portal</h4><p>Use your approved staff account.</p><label htmlFor="cpa-account-sample">Staff account</label><input id="cpa-account-sample" disabled placeholder="Sample only"/><button type="button" className="cpa-disabled-action" disabled>Continue</button></div>
            <aside className="cpa-activation"><strong>Account activation is invitation-only.</strong><p>Self-service sign-up is not available. An invitation is required before portal access can be activated.</p></aside>
          </div>
        </div>
      </section>

      <section className="cpa-section" aria-labelledby="daily-log-title">
        <div className="cpa-section-heading"><div><h2 id="daily-log-title">Daily Performance Log</h2><p>Representative form copy · field values are fictional placeholders.</p></div><span className="cpa-section-kicker">Fictional · not a record</span></div>
        <form className="cpa-form" onSubmit={event=>event.preventDefault()}>
          <div className="cpa-form-head"><h3>Daily Performance Log</h3><span className="cpa-fictitious">FICTIONAL SAMPLE · REVIEW ONLY</span></div>
          <div className="cpa-form-body">
            <div className="cpa-form-grid">
              <div className="cpa-field"><label htmlFor="cpa-date">Date <span className="cpa-required">*</span></label><input id="cpa-date" type="text" placeholder="MM/DD/YYYY" aria-invalid="true" aria-describedby="cpa-date-validation"/></div>
              <div className="cpa-field"><label htmlFor="cpa-phase">Phase</label><select id="cpa-phase" defaultValue="Phase I"><option>Phase I</option><option>Phase II</option><option>Phase III</option></select></div>
              <div className="cpa-field"><label htmlFor="cpa-po">Probationary officer</label><input id="cpa-po" defaultValue="Fictional PO"/></div>
              <div className="cpa-field wide"><label>Daily rating · sample category</label><div className="cpa-rating-options" aria-label="Rating values shown for reference"><span className="cpa-rating">NO</span><span className="cpa-rating selected">A</span><span className="cpa-rating">RT</span><span className="cpa-rating">UA</span><span className="cpa-rating">NRT</span></div></div>
              <div className="cpa-field wide"><label htmlFor="cpa-narrative">Narrative</label><textarea id="cpa-narrative" placeholder="Fictional sample · no operational details."/></div>
            </div>
            <p className="cpa-validation" id="cpa-date-validation" role="alert">Enter a date to continue.</p>
            <div className="cpa-form-footer"><button type="button" disabled>Save locally</button><span>Sample edits are not saved · not uploaded</span></div>
            <p className="cpa-context-help">Need steps for a local draft? <button type="button" onClick={()=>{setQuery("save");setActiveTitle(topics[0].title);document.getElementById("application-search")?.scrollIntoView({behavior:"smooth",block:"center"});document.querySelector<HTMLInputElement>('[aria-label="Search Help Desk topics"]')?.focus();}}>Help Desk · Save and reopen a local draft</button></p>
          </div>
        </form>
      </section>

      <section className="cpa-section" aria-labelledby="scope-title">
        <div className="cpa-section-heading"><div><h2 id="scope-title">Copy-scope inventory</h2><p>Concise screen copy stays in context; longer application explanations belong in Help.</p></div><span className="cpa-section-kicker">Proposal scope</span></div>
        <div className="cpa-scope">{scopeRows.map(([label,copy])=><div className="cpa-scope-row" key={label}><strong>{label}</strong><span>{copy}</span></div>)}</div>
      </section>
      <footer className="cpa-footer-note"><strong>Packet scope:</strong> Upload controls are outside this copy review and remain separate.</footer>
    </div>
  </main>;
}
