'use strict';
/* CasaChiara 2.5 — file cifrati con PBKDF2 e AES-GCM, solo nel browser. */
(function(g){
  const FORMAT='casachiara.backup.encrypted';
  const ITERATIONS=310000;
  const enc=new TextEncoder(),dec=new TextDecoder();
  const crypto=g.crypto;
  const limit=32*1024*1024;
  const b64=bytes=>{let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out)};
  const bytes=value=>{if(typeof value!=='string'||!value||value.length>limit||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('Codifica del backup cifrato non valida.');return Uint8Array.from(atob(value),c=>c.charCodeAt(0))};
  const enabled=()=>!!(crypto?.subtle&&crypto?.getRandomValues);
  async function derive(password,salt,iterations){
    if(!enabled())throw Error('Cifratura non disponibile: apri CasaChiara tramite HTTPS.');
    const base=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(plain,password,appVersion){
    if(typeof password!=='string'||password.length<12)throw Error('Usa una password di almeno 12 caratteri.');
    if(typeof plain!=='string'||plain.length>limit)throw Error('Archivio troppo grande.');
    if(!enabled())throw Error('La crittografia non è disponibile su questo dispositivo.');
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await derive(password,salt,ITERATIONS);
    const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(plain)));
    return {format:FORMAT,backupVersion:1,appVersion,exportedAt:new Date().toISOString(),
      kdf:{name:'PBKDF2',hash:'SHA-256',iterations:ITERATIONS,salt:b64(salt)},
      cipher:{name:'AES-GCM',iv:b64(iv)},ciphertext:b64(cipher)};
  }
  async function decrypt(envelope,password){
    if(!envelope||envelope.format!==FORMAT||envelope.backupVersion!==1||
       envelope.kdf?.name!=='PBKDF2'||envelope.kdf.hash!=='SHA-256'||
       envelope.cipher?.name!=='AES-GCM'||!Number.isInteger(envelope.kdf.iterations)||
       envelope.kdf.iterations<200000||envelope.kdf.iterations>1000000)throw Error('Formato cifrato non supportato.');
    if(typeof password!=='string'||!password)throw Error('Password necessaria per aprire questo backup.');
    const salt=bytes(envelope.kdf.salt),iv=bytes(envelope.cipher.iv),ciphertext=bytes(envelope.ciphertext);
    if(salt.length!==16||iv.length!==12||ciphertext.length<17)throw Error('Parametri crittografici non validi.');
    const key=await derive(password,salt,envelope.kdf.iterations);
    try{return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ciphertext))}
    catch{throw Error('Password errata oppure backup cifrato alterato: nessun dato importato.')}
  }
  g.CasaChiaraSecureBackup=Object.freeze({encrypt,decrypt,enabled,FORMAT});
})(globalThis);
