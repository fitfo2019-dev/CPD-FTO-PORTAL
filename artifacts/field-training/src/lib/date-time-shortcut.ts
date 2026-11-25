import { currentDateTimeMDY } from './training-calendar.js';

type ShortcutEvent = {
  key:string;
  currentTarget:{value:string;readOnly?:boolean;disabled?:boolean};
  preventDefault():void;
};

/** Tab fills the value and keeps normal focus movement; Enter fills without submitting. */
export function applyCurrentDateTimeShortcut(event:ShortcutEvent, kind:'date'|'time'|'datetime', apply:(value:string)=>void) {
  if(event.currentTarget.readOnly||event.currentTarget.disabled||event.currentTarget.value.trim()!=='?'||(event.key!=='Tab'&&event.key!=='Enter')) return;
  if(event.key==='Enter') event.preventDefault();
  const now=currentDateTimeMDY();
  apply(kind==='date'?now.date:kind==='time'?now.time:`${now.date} ${now.time}`);
}
