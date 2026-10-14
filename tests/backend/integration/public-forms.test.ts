import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import { createBootstrapToken, bootstrap } from "../../../src/server/auth/bootstrap";
import { issueFormOwner, verifyFormOwner, issuePublicCapability, submitPublicForm, revisePublicApplicant, requestPublicReturn } from "../../../src/server/domains/public-forms";
import { publicUploadOwner } from "../../../src/server/media/public-upload";
import { setEquipmentAvailability } from "../../../src/server/domains/inventory";
import { login } from "../../../src/server/auth/login";
import { GET as formContext } from "../../../src/app/api/public/forms/context/route";
import { handlePublicSubmit, handlePublicLookup } from "../../../src/server/http/public-form-handlers";
import { nativeHandlerServer } from "./native-handler-server";
import { POST as reviseRoute } from "../../../src/app/api/public/forms/revise/route";
import { POST as returnRoute } from "../../../src/app/api/public/forms/return/route";
import { POST as invoiceRoute } from "../../../src/app/api/public/forms/invoice/route";
import { handlePublicUpload } from "../../../src/server/http/public-form-handlers";
import { createPreAuthToken } from "../../../src/server/security/csrf";
import { cookieName } from "../../../src/server/http/auth-handler";
import { formOwnerCookieName } from "../../../src/server/domains/public-forms";
import { saveEvent, publishEvent } from "../../../src/server/domains/events";
import { issueEventFormToken } from "../../../src/server/security/event-form-token";
import { handleEventRegistration, handleEventUpload } from "../../../src/server/http/event-public-handlers";
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import { mediaRoot, mediaPath } from "../../../src/server/media/paths";
const fields = {
  nama: "Peserta", nim: "001234", prodi: "Informatika", telepon: "081234567890", email: "peserta@example.org",
  tempat_lahir: "Kota", tanggal_lahir: "2005-01-01", jenis_kelamin: "Laki-laki", golongan_darah: "O", agama: "Lainnya",
  alamat_rumah: "Rumah", alamat_domisili: "Domisili", nama_orangtua: "Orang tua", telepon_orangtua: "081234567891",
  motivasi: "Belajar", pengalaman_organisasi: "", riwayat_penyakit: "",
};
const owner = () => verifyFormOwner(issueFormOwner());
const submit = (payload: unknown, idempotencyKey = randomUUID()) => ({kind:"recruitment",idempotencyKey,consent:true,payload});
beforeEach(async () => {
  await clean();
  await getDb().publicFormReceipt.deleteMany();
  await bootstrap({token:(await createBootstrapToken(ctx)).token,password:"public-forms-test-passphrase"},ctx);
  await getDb().recruitmentPeriod.create({data:{year:2026,active:true}});
});

test("native public capability routes reject foreign owners and preserve return and revision authority",async()=>{
  const signedOwner=issueFormOwner(),o=verifyFormOwner(signedOwner),csrf=createPreAuthToken();
  const cookies=`${cookieName("preauth")}=${csrf}; ${formOwnerCookieName()}=${signedOwner}`;
  const server=await nativeHandlerServer(request=>{
    const path=new URL(request.url).pathname;
    if(path.endsWith("/revise"))return reviseRoute(request);
    if(path.endsWith("/return"))return returnRoute(request);
    if(path.endsWith("/invoice"))return invoiceRoute(request);
    if(path.endsWith("/uploads"))return handlePublicUpload(request,async()=>{});
    return Promise.resolve(new Response(null,{status:404}));
  });
  const send=(path:string,input:unknown,cookie=cookies)=>fetch(server.url+"/api/public/forms/"+path,{method:"POST",headers:{origin:process.env.APP_URL!,cookie,"x-csrf-token":csrf,"content-type":"application/json"},body:JSON.stringify(input)});
  try {
    await submitPublicForm(submit({year:2026,fields,photo:""}),o,ctx,async()=>{});
    const applicant=await getDb().applicant.findFirstOrThrow(),orCapability=issuePublicCapability("recruitment",applicant.id,o);
    assert.equal((await send("revise",{capability:orCapability,revisions:0,fields:{...fields,motivasi:"Revisi HTTP"}})).status,200);
    assert.equal((await send("revise",{capability:orCapability,revisions:0,fields})).status,409);
    const equipment=await getDb().equipment.create({data:{code:"HTTP-EQ",name:"Tenda HTTP",category:"Camp",total:2,fit:2,condition:"Baik",location:"Sekretariat"}});
    const loan=await getDb().loan.create({data:{code:"WPLHTP",institution:"Lembaga",pic:"PIC",phone:"081234567890",email:"pic@example.org",phoneDigest:"digest",start:new Date("2030-01-01"),end:new Date("2030-01-02"),purpose:"Latihan",event:"Acara",collateral:"KTM",originYear:2026,managementYear:2026,status:"approved",items:{create:{equipmentId:equipment.id,requested:1,approved:1}}}});
    const capability=issuePublicCapability("loan",loan.id,o);
    const foreignCookies=`${cookieName("preauth")}=${csrf}; ${formOwnerCookieName()}=${issueFormOwner()}`;
    assert.equal((await send("invoice",{capability},foreignCookies)).status,403);
    const pdf=await send("invoice",{capability});assert.equal(pdf.status,200);assert.match(pdf.headers.get("content-type")!,/application\/pdf/);
    const bytes=Buffer.from(await pdf.arrayBuffer());
    assert.match(bytes.subarray(0,8).toString(),/^%PDF-/);
    const source=bytes.toString("latin1");
    assert.ok(source.includes("FORM PEMINJAMAN ALAT LOGISTIK"));
    assert.ok(source.includes("Dokumen peminjaman resmi"));
    assert.ok(source.includes("Salinan peminjam"));
    assert.ok(source.includes("Arsip logistik"));
    assert.equal((await send("return",{capability,note:""})).status,409);
    await getDb().loan.update({where:{id:loan.id},data:{status:"borrowed"}});
    assert.equal((await send("return",{capability,note:"Diserahkan"})).status,200);assert.equal((await getDb().loan.findUniqueOrThrow({where:{id:loan.id}})).status,"awaiting_return");
    const upload=new FormData();upload.set("purpose","applicant-photo");upload.set("scope","2026");upload.set("file",new Blob(["disguised executable"],{type:"image/png"}),"photo.png");
    const invalid=await fetch(server.url+"/api/public/forms/uploads",{method:"POST",headers:{origin:process.env.APP_URL!,cookie:cookies,"x-csrf-token":csrf},body:upload});assert.equal(invalid.status,400);assert.equal(await getDb().media.count(),0);
  } finally {await server.close();}
});

test("native Event registration preserves owner-bound receipts without third-party verification",async()=>{
  const principal=(await login({email:"superuser@wapala.org",password:"public-forms-test-passphrase"},ctx)).principal;
  const draft=await saveEvent(principal,{title:"Event HTTP",description:"Pendaftaran",cover:"",poster:"",location:"",eventAt:"",start:"",end:"",quota:10,form:{title:"Form",description:"",items:[]}},ctx);
  const event=await publishEvent(principal,{id:draft.id,version:draft.version},ctx),revisionId=event.publishedRevisionId!;
  const token=issueEventFormToken(event.id,revisionId),context={params:Promise.resolve({id:event.id})};
  const server=await nativeHandlerServer(request=>new URL(request.url).pathname.endsWith("/uploads")?handleEventUpload(request,context):handleEventRegistration(request,context));
  const body={eventId:event.id,revisionId,idempotencyKey:randomUUID(),answers:{}};
  const send=(t=token)=>fetch(server.url+"/registrations",{method:"POST",headers:{origin:process.env.APP_URL!,"content-type":"application/json","x-event-token":t},body:JSON.stringify(body)});
  try {
    const response=await send();assert.equal(response.status,201);const receipt=await response.json();
    const replay=await send();assert.equal(replay.status,201);assert.deepEqual(await replay.json(),receipt);assert.equal(await getDb().eventRegistration.count(),1);
    assert.equal((await send(issueEventFormToken(event.id,revisionId))).status,409);
    const upload=new FormData();upload.set("file",new Blob(["test"],{type:"image/png"}),"photo.png");upload.set("questionId",randomUUID());
    const missing=await fetch(server.url+"/uploads",{method:"POST",headers:{origin:process.env.APP_URL!,"x-event-token":token},body:upload});assert.equal(missing.status,400);
  } finally {await server.close();}
});

test("native scanner public uploads stay private and bind atomically to the owner's receipt",{skip:process.env.WAPALA_TEST_NATIVE_SCANNER!=="1"},async()=>{
  const signedOwner=issueFormOwner(),o=verifyFormOwner(signedOwner),csrf=createPreAuthToken();
  const cookies=`${cookieName("preauth")}=${csrf}; ${formOwnerCookieName()}=${signedOwner}`;
  const server=await nativeHandlerServer(request=>handlePublicUpload(request,async()=>{}));
  let id="";
  try {
    const bytes=await sharp({create:{width:24,height:32,channels:3,background:"green"}}).png().toBuffer();
    const form=new FormData();form.set("purpose","applicant-photo");form.set("scope","2026");form.set("file",new Blob([new Uint8Array(bytes)],{type:"image/png"}),"photo.png");
    const response=await fetch(server.url+"/uploads",{method:"POST",headers:{origin:process.env.APP_URL!,cookie:cookies,"x-csrf-token":csrf},body:form});assert.equal(response.status,201,await response.clone().text());
    const upload=await response.json();id=upload.id;const media=await getDb().media.findUniqueOrThrow({where:{id}});assert.equal(media.visibility,"private");assert.equal(media.boundTo,null);
    await submitPublicForm(submit({year:2026,fields,photo:upload.url}),o,ctx,async()=>{});
    assert.ok((await getDb().media.findUniqueOrThrow({where:{id}})).boundTo);
  } finally {await server.close();if(id)await unlink(mediaPath(mediaRoot(),id,"webp"));}
});
after(() => getDb().$disconnect());

test("concurrent public submissions atomically issue one receipt and encrypted email",async()=>{
  const input=submit({year:2026,fields,photo:""}), o=owner();
  let calls=0;const verify=async()=>{calls++;};
  const responses=await Promise.all([submitPublicForm(input,o,ctx,verify),submitPublicForm(input,o,ctx,verify)]);
  assert.deepEqual(responses[0],responses[1]);assert.equal(calls,1);
  assert.equal(await getDb().applicant.count(),1);assert.equal(await getDb().publicFormReceipt.count(),1);
  const emails=await getDb().emailOutbox.findMany();assert.equal(emails.length,1);assert.ok(!emails[0].payload?.includes(fields.email));
  await assert.rejects(submitPublicForm({...input,payload:{year:2026,fields:{...fields,nama:"Berbeda"},photo:""}},o,ctx,verify),{code:"IDEMPOTENCY_CONFLICT"});
  await assert.rejects(submitPublicForm(input,owner(),ctx,verify),{code:"IDEMPOTENCY_CONFLICT"});
});

test("failed domain submission rolls back receipt, media binding and email",async()=>{
  const o=owner(), id=randomUUID();
  await getDb().media.create({data:{id,purpose:"applicant-photo",visibility:"private",mime:"image/webp",extension:"webp",checksum:"hash",originalHash:"hash",size:20,ownerDigest:publicUploadOwner("applicant-photo","2026",o),scannedAt:new Date()}});
  await getDb().recruitmentPeriod.update({where:{year:2026},data:{active:false}});
  await assert.rejects(submitPublicForm(submit({year:2026,fields,photo:"/api/media/"+id}),o,ctx,async()=>{}),/Pendaftaran periode ini ditutup/);
  assert.equal((await getDb().media.findUniqueOrThrow({where:{id}})).boundTo,null);
  assert.equal(await getDb().publicFormReceipt.count(),0);assert.equal(await getDb().emailOutbox.count(),0);
});

test("public uploads cannot be submitted by another owner or a different scope",async()=>{
  const o=owner(), id=randomUUID();
  await getDb().media.create({data:{id,purpose:"applicant-photo",visibility:"private",mime:"image/webp",extension:"webp",checksum:"hash",originalHash:"hash",size:20,ownerDigest:publicUploadOwner("applicant-photo","2027",o),scannedAt:new Date()}});
  await assert.rejects(submitPublicForm(submit({year:2026,fields,photo:"/api/media/"+id}),o,ctx,async()=>{}),/Unggah berkas/);
  await getDb().media.update({where:{id},data:{ownerDigest:publicUploadOwner("applicant-photo","2026",owner())}});
  await assert.rejects(submitPublicForm(submit({year:2026,fields,photo:"/api/media/"+id}),o,ctx,async()=>{}),/Unggah berkas/);
  assert.equal(await getDb().applicant.count(),0);
});

test("applicant revisions preserve snapshots and reject stale concurrent changes",async()=>{
  const o=owner();await submitPublicForm(submit({year:2026,fields,photo:""}),o,ctx,async()=>{});
  const row=await getDb().applicant.findFirstOrThrow(), capability=issuePublicCapability("recruitment",row.id,o);
  const result=await revisePublicApplicant({capability,revisions:0,fields:{...fields,motivasi:"Motivasi baru"}},o,ctx);
  assert.equal(result.revisions,1);assert.equal((await getDb().applicantRevision.findFirstOrThrow()).fields && ((await getDb().applicantRevision.findFirstOrThrow()).fields as {motivasi:string}).motivasi,"Belajar");
  await assert.rejects(revisePublicApplicant({capability,revisions:0,fields:{...fields,motivasi:"Stale"}},o,ctx),{code:"CONFLICT"});
});

test("public return keeps active stock obligations and never verifies returned",async()=>{
  const o=owner(), loan=await getDb().loan.create({data:{code:"WPLTEST",institution:"Lembaga",pic:"PIC",phone:"081234567890",email:"pic@example.org",phoneDigest:"digest",start:new Date("2030-01-01"),end:new Date("2030-01-02"),purpose:"Latihan",event:"Acara",collateral:"KTM",originYear:2026,managementYear:2026,status:"borrowed"}});
  const capability=issuePublicCapability("loan",loan.id,o);
  assert.deepEqual(await requestPublicReturn({capability,note:"Barang diserahkan"},o,ctx),{status:"awaiting_return"});
  assert.equal((await getDb().loan.findUniqueOrThrow({where:{id:loan.id}})).status,"awaiting_return");
  assert.equal(await getDb().loanHistory.count({where:{loanId:loan.id,status:"returned"}}),0);
  await getDb().loan.update({where:{id:loan.id},data:{status:"requested"}});
  await assert.rejects(requestPublicReturn({capability,note:""},o,ctx),{code:"INVALID_TRANSITION"});
});

test("availability PATCH rejects stale versions and changes no stock or metadata",async()=>{
  const principal=(await login({email:"superuser@wapala.org",password:"public-forms-test-passphrase"},ctx)).principal;
  const e=await getDb().equipment.create({data:{code:"TEST",name:"Tenda",category:"Camp",total:3,fit:2,condition:"Baik",location:"Sekretariat",available:true,maxDays:7,maxQuantity:2}});
  const updated=await setEquipmentAvailability(principal,{id:e.id,version:e.version,available:false},ctx);
  assert.equal(updated.available,false);assert.equal(updated.version,e.version+1);assert.equal(updated.fit,2);assert.equal(updated.total,3);assert.equal(updated.name,"Tenda");
  await assert.rejects(setEquipmentAvailability(principal,{id:e.id,version:e.version,available:true},ctx),{code:"CONFLICT"});
});

test("public HTTP requires origin, consent and owner cookie, then replays across CSRF renewal",async()=>{
  const server=await nativeHandlerServer(request=>{
    const path=new URL(request.url).pathname;
    if(path.endsWith("/context"))return formContext(request);
    if(path.endsWith("/submit"))return handlePublicSubmit(request);
    if(path.endsWith("/lookup"))return handlePublicLookup(request);
    return Promise.resolve(new Response(null,{status:404}));
  });
  try {
    const context=await fetch(server.url+"/api/public/forms/context");assert.equal(context.status,200);
    const data=await context.json(), cookies=context.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    const input=submit({year:2026,fields,photo:""});
    const send=(value:unknown,cookie=cookies,csrf=data.csrfToken,origin=process.env.APP_URL!)=>fetch(server.url+"/api/public/forms/submit",{method:"POST",headers:{"content-type":"application/json",origin,cookie,"x-csrf-token":csrf},body:JSON.stringify(value)});
    assert.equal((await send(input,cookies,data.csrfToken,"https://foreign.example")).status,403);
    assert.equal((await send({...input,consent:false})).status,400);
    const first=await send(input);assert.equal(first.status,200);const receipt=await first.json();
    const renewed=await fetch(server.url+"/api/public/forms/context",{headers:{cookie:cookies}});
    const renewedData=await renewed.json(), renewedCookies=renewed.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    const retry=await send(input,renewedCookies,renewedData.csrfToken);assert.equal(retry.status,200);assert.deepEqual(await retry.json(),receipt);
    const look=(phone:string)=>fetch(server.url+"/api/public/forms/lookup",{method:"POST",headers:{"content-type":"application/json",origin:process.env.APP_URL!,cookie:renewedCookies,"x-csrf-token":renewedData.csrfToken},body:JSON.stringify({kind:"recruitment",code:receipt.code,phone})});
    assert.equal((await look("081111111111")).status,404);
    const found=await look(fields.telepon);assert.equal(found.status,200);const own=await found.json();assert.equal(own.record.fields.nim,fields.nim);assert.ok(own.capability);assert.ok(!("phoneDigest" in own.record));
  } finally { await server.close(); }
});
