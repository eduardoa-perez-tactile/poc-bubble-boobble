export interface NativeAudioStatus {
 revision?:number;
 windowReady?:boolean;
 adapterActive?:boolean;
 error?:string;
}
/** HTTP acceptance alone cannot certify a running native audio backend. */
export class NativeAudioReadiness {
 private minimumRevision:number|undefined;
 available=false;
 error='';
 acknowledge(revision:unknown):void {
  if(typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<0)throw new Error('Invalid desktop adapter revision');
  this.minimumRevision=Math.max(this.minimumRevision??0,revision);
 }
 observe(native:NativeAudioStatus):boolean {
  if(this.minimumRevision===undefined||typeof native.revision!=='number'||!Number.isSafeInteger(native.revision)||native.revision<this.minimumRevision)return false;
  this.error=typeof native.error==='string'?native.error:'Native audio status unavailable';
  if(!native.windowReady||!native.adapterActive)this.error=this.error||'Native adapter unavailable';
  this.available=!this.error;
  return true;
 }
 reset():void {this.minimumRevision=undefined;this.available=false;this.error='';}
}
