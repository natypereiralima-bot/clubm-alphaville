import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const G = {
  bg:"#09090F",card:"#111118",border:"#1C1C2E",gold:"#C9A84C",
  goldL:"#E8C96A",text:"#E8E8F2",muted:"#7070A0",dim:"#3A3A58",
  red:"#E05555",green:"#2EB87A",blue:"#4A90D9",purple:"#8B6FD4",
  warn:"#D4843A",pink:"#C45E9A"
};

const STEPS=[
  {id:0,label:"Pix recebido — dados solicitados",day:0,block:1,desc:"Confirmar recebimento e solicitar CNH, endereço, e-mail e telefone"},
  {id:1,label:"Dados encaminhados à secretária",day:0,block:1,desc:"Enviar com tag #novo-membro + forma de pagamento"},
  {id:2,label:"Contrato emitido e enviado",day:0,block:1,desc:"Emitir na plataforma e enviar para assinatura digital (até 2h)"},
  {id:3,label:"Link de pagamento enviado",day:0,block:1,desc:"Gerar link cartão (à vista) ou boletos (parcelado)"},
  {id:4,label:"Formulário de perfil enviado",day:0,block:1,desc:"Foto, empresa, cargo, segmento, objetivo no clube"},
  {id:5,label:"Onboarding presencial agendado",day:3,block:1,desc:"Máximo 72h após entrada"},
  {id:6,label:"Foto profissional recebida",day:2,block:2,desc:"Aguardar retorno do formulário (até 48h)"},
  {id:7,label:"Card visual produzido",day:4,block:2,desc:"Até 48h após receber a foto"},
  {id:8,label:"Texto de boas-vindas redigido",day:4,block:2,desc:"Personalizado: quem é, o que faz, o que busca"},
  {id:9,label:"Membro adicionado ao grupo",day:4,block:2,desc:"Adicionar ANTES de postar o card"},
  {id:10,label:"Card postado no grupo",day:5,block:2,desc:"Card + texto + saudação do gestor"},
  {id:11,label:"Onboarding presencial realizado",day:5,block:2,desc:"Apresentar espaço, eventos, plataforma e programa de indicações"},
  {id:12,label:"Follow-up D+7 (pós-onboarding)",day:7,block:3,desc:"Verificar como o membro está e abrir programa de indicações"},
  {id:13,label:"Sessão mapeamento de indicações",day:7,block:3,desc:"30 min — construir lista de 10-15 potenciais indicados"},
];

const STAGES=[
  {id:"contato_inicial",label:"Contato Inicial",color:G.muted},
  {id:"nao_responde",label:"Não Responde",color:G.red},
  {id:"em_discussao",label:"Em Discussão",color:G.warn},
  {id:"agendado_reuniao",label:"Reunião Agendada",color:G.blue},
  {id:"negociacao",label:"Negociação Pós-Reunião",color:G.purple},
  {id:"evento_experience",label:"Evento Experience",color:G.pink},
  {id:"vendido",label:"Vendido",color:G.green},
  {id:"membro",label:"Membro",color:G.gold},
];

const CONTACT_TYPES=["Mensagem","Telefone","Presencial","E-mail"];
const MEETING_RESULTS=["Agendada","Realizada","No Show","Reagendada"];

const fmt=d=>d?new Date(d+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const todayStr=()=>new Date().toISOString().split("T")[0];
const addDays=(date,n)=>{const d=new Date(date+"T12:00:00");d.setDate(d.getDate()+n);return d;};

const emptyMember=()=>({name:"",company:"",role:"",segment:"",email:"",phone:"",entryDate:todayStr(),paymentType:"parcelado",notes:""});
const emptyBilling=()=>({memberName:"",contactDate:todayStr(),contactType:"Mensagem",result:"",notes:""});
const emptyLead=()=>({name:"",company:"",phone:"",stage:"contato_inicial",contactDate:todayStr(),contactType:"Mensagem",evolved:false,meetingDate:"",meetingResult:"",notes:""});

const serializeMembers=ms=>ms.map(m=>({...m,stepsCompleted:(m.stepsCompleted||[]).join(",")}));
const deserializeMembers=rows=>rows.map(r=>({...r,id:Number(r.id)||Date.now(),stepsCompleted:r.stepsCompleted?r.stepsCompleted.split(",").map(Number).filter(n=>!isNaN(n)):[]}));
const deserializeLeads=rows=>rows.map(r=>({...r,id:Number(r.id)||Date.now(),evolved:r.evolved==="true"||r.evolved===true}));
const deserializeBillings=rows=>rows.map(r=>({...r,id:Number(r.id)||Date.now()}));

const Input=({label,type="text",value,onChange,options,placeholder=""})=>(
  <div style={{marginBottom:10}}>
    {label&&<div style={{color:G.muted,fontSize:11,marginBottom:4,fontWeight:600,letterSpacing:0.5}}>{label}</div>}
    {options?(
      <select value={value} onChange={onChange} style={{width:"100%",background:G.bg,border:`1px solid ${G.dim}`,borderRadius:8,padding:"8px 10px",color:G.text,fontSize:13,boxSizing:"border-box"}}>
        {options.map(o=>typeof o==="string"?<option key={o}>{o}</option>:<option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    ):type==="textarea"?(
      <textarea value={value} onChange={onChange} placeholder={placeholder} style={{width:"100%",background:G.bg,border:`1px solid ${G.dim}`,borderRadius:8,padding:"8px 10px",color:G.text,fontSize:13,minHeight:56,boxSizing:"border-box",resize:"vertical"}}/>
    ):(
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{width:"100%",background:G.bg,border:`1px solid ${G.dim}`,borderRadius:8,padding:"8px 10px",color:G.text,fontSize:13,boxSizing:"border-box"}}/>
    )}
  </div>
);

const Btn=({label,onClick,variant="gold",small})=>{
  const s={
    gold:{background:`linear-gradient(135deg,${G.gold},${G.goldL})`,color:"#08080E",border:"none"},
    ghost:{background:"transparent",color:G.muted,border:`1px solid ${G.dim}`},
    danger:{background:G.red+"22",color:G.red,border:`1px solid ${G.red}44`}
  };
  return <button onClick={onClick} style={{...s[variant],borderRadius:8,padding:small?"5px 12px":"8px 18px",cursor:"pointer",fontWeight:700,fontSize:small?12:13}}>{label}</button>;
};

const Badge=({label,color})=>(
  <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",display:"inline-block"}}>{label}</span>
);

const Card=({children,style={}})=>(
  <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:16,marginBottom:12,...style}}>{children}</div>
);

export default function App(){
  // ── localStorage ativo (funciona no Vercel) ──
  const [apiUrl,setApiUrl]=useState(()=>localStorage.getItem("clubm_url")||"");
  const [urlInput,setUrlInput]=useState(()=>localStorage.getItem("clubm_url")||"");

  const [tab,setTab]=useState("dashboard");
  const [members,setMembers]=useState([]);
  const [billings,setBillings]=useState([]);
  const [leads,setLeads]=useState([]);
  const [status,setStatus]=useState("idle");
  const [showSettings,setShowSettings]=useState(false);
  const [showMForm,setShowMForm]=useState(false);
  const [showBForm,setShowBForm]=useState(false);
  const [showLForm,setShowLForm]=useState(false);
  const [expandedMember,setExpandedMember]=useState(null);
  const [expandedLead,setExpandedLead]=useState(null);
  const [editingLead,setEditingLead]=useState(null);
  const [mForm,setMForm]=useState(emptyMember());
  const [bForm,setBForm]=useState(emptyBilling());
  const [lForm,setLForm]=useState(emptyLead());
  const saveTimer=useRef(null);
  const isLoaded=useRef(false);
  const today=todayStr();

  const loadAll=useCallback(async(url)=>{
    if(!url){setStatus("nourl");return;}
    setStatus("loading");
    try{
      const [mr,br,lr]=await Promise.all([
        fetch(`${url}?action=get&sheet=Membros`).then(r=>r.json()),
        fetch(`${url}?action=get&sheet=Cobrancas`).then(r=>r.json()),
        fetch(`${url}?action=get&sheet=Leads`).then(r=>r.json()),
      ]);
      if(mr.rows?.length) setMembers(deserializeMembers(mr.rows));
      if(br.rows?.length) setBillings(deserializeBillings(br.rows));
      if(lr.rows?.length) setLeads(deserializeLeads(lr.rows));
      isLoaded.current=true;
      setStatus("saved");
    }catch(e){setStatus("error");}
  },[]);

  useEffect(()=>{if(apiUrl) loadAll(apiUrl);},[apiUrl]);

  const saveAll=useCallback(async(m,b,l,url)=>{
    if(!url||!isLoaded.current) return;
    setStatus("saving");
    try{
      const enc=obj=>`${url}?action=save&sheet=${obj.sheet}&data=${encodeURIComponent(JSON.stringify(obj.data))}`;
      await Promise.all([
        fetch(enc({sheet:"Membros",data:serializeMembers(m)})),
        fetch(enc({sheet:"Cobrancas",data:b})),
        fetch(enc({sheet:"Leads",data:l.map(x=>({...x,evolved:String(x.evolved)}))})),
      ]);
      setStatus("saved");
    }catch(e){setStatus("error");}
  },[]);

  useEffect(()=>{
    if(!isLoaded.current||!apiUrl) return;
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>saveAll(members,billings,leads,apiUrl),2000);
    return()=>clearTimeout(saveTimer.current);
  },[members,billings,leads,apiUrl,saveAll]);

  const saveUrl=()=>{
    const u=urlInput.trim();
    localStorage.setItem("clubm_url",u); // salva permanentemente no navegador
    setApiUrl(u);
    setShowSettings(false);
    isLoaded.current=false;
    setMembers([]); setBillings([]); setLeads([]);
  };

  const statusCfg={
    idle:{color:G.muted,label:"–"},
    nourl:{color:G.warn,label:"⚙ Configure o Sheets"},
    loading:{color:G.blue,label:"⟳ Carregando…"},
    saving:{color:G.warn,label:"⟳ Salvando…"},
    saved:{color:G.green,label:"✓ Salvo no Sheets"},
    error:{color:G.red,label:"✗ Erro de conexão"},
  };
  const sc=statusCfg[status]||statusCfg.idle;

  const today0=new Date(); today0.setHours(0,0,0,0);

  const toggleStep=(mid,sid)=>setMembers(ms=>ms.map(m=>{
    if(m.id!==mid) return m;
    const sc=m.stepsCompleted||[];
    return {...m,stepsCompleted:sc.includes(sid)?sc.filter(x=>x!==sid):[...sc,sid]};
  }));

  const saveMember=()=>{
    setMembers(ms=>[...ms,{...mForm,id:Date.now(),stepsCompleted:[]}]);
    setMForm(emptyMember()); setShowMForm(false);
  };
  const saveBilling=()=>{
    setBillings(bs=>[...bs,{...bForm,id:Date.now()}]);
    setBForm(emptyBilling()); setShowBForm(false);
  };
  const saveLead=()=>{
    if(editingLead){
      setLeads(ls=>ls.map(l=>l.id===editingLead?{...lForm,id:editingLead}:l));
      setEditingLead(null);
    }else{
      setLeads(ls=>[...ls,{...lForm,id:Date.now()}]);
    }
    setLForm(emptyLead()); setShowLForm(false);
  };
  const editLead=l=>{setLForm({...l});setEditingLead(l.id);setShowLForm(true);setExpandedLead(null);};
  const stageOf=id=>STAGES.find(s=>s.id===id)||STAGES[0];

  const metrics=useMemo(()=>{
    const todayBillings=billings.filter(b=>b.contactDate===today).length;
    const todayLeads=leads.filter(l=>l.contactDate===today).length;
    const totalAtend=todayBillings+todayLeads;
    const reunAgendadas=leads.filter(l=>l.meetingResult==="Agendada"||(l.meetingDate&&!l.meetingResult)).length;
    const reunRealizadas=leads.filter(l=>l.meetingResult==="Realizada").length;
    const noShow=leads.filter(l=>l.meetingResult==="No Show").length;
    const negociacoes=leads.filter(l=>l.stage==="negociacao").length;
    const followUp=leads.filter(l=>!l.evolved&&!["vendido","membro"].includes(l.stage)).length;
    const vendas=leads.filter(l=>["vendido","membro"].includes(l.stage)).length;
    const overdues=[];
    members.forEach(m=>{
      STEPS.forEach(s=>{
        if(m.stepsCompleted?.includes(s.id)) return;
        const due=addDays(m.entryDate,s.day);
        if(due<today0) overdues.push({member:m.name,step:s.label,due});
      });
    });
    const todayMeetings=leads.filter(l=>l.meetingDate===today);
    return{totalAtend,reunAgendadas,reunRealizadas,noShow,negociacoes,followUp,vendas,overdues,todayMeetings};
  },[members,billings,leads,today]);

  const MetCard=({val,label,color})=>(
    <div style={{background:"#0D0D18",border:`1px solid ${G.border}`,borderRadius:12,padding:"14px 10px",textAlign:"center"}}>
      <div style={{fontSize:26,fontWeight:800,color:color||G.gold}}>{val}</div>
      <div style={{fontSize:10,color:G.muted,marginTop:4,lineHeight:1.3}}>{label}</div>
    </div>
  );

  const StepBlock=({title,steps,member})=>(
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:1,marginBottom:8,padding:"4px 8px",background:G.gold+"15",borderRadius:6,display:"inline-block"}}>{title}</div>
      {steps.map(s=>{
        const done=member.stepsCompleted?.includes(s.id);
        const due=addDays(member.entryDate,s.day);
        const overdue=!done&&due<today0;
        const dueToday=!done&&!overdue&&due.toDateString()===today0.toDateString();
        return(
          <div key={s.id} onClick={()=>toggleStep(member.id,s.id)}
            style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:8,marginBottom:4,cursor:"pointer",background:done?G.green+"0C":overdue?G.red+"0C":dueToday?G.gold+"0C":"#ffffff04",border:`1px solid ${done?G.green+"30":overdue?G.red+"30":dueToday?G.gold+"30":"transparent"}`}}>
            <div style={{width:18,height:18,borderRadius:"50%",flexShrink:0,background:done?G.green:overdue?G.red:dueToday?G.gold:G.dim,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {done&&<span style={{color:"#fff",fontSize:10,fontWeight:800}}>✓</span>}
            </div>
            <span style={{flex:1,fontSize:12,color:done?G.muted:overdue?G.red:G.text,textDecoration:done?"line-through":"none"}}>{s.label}</span>
            <span style={{fontSize:10,color:overdue?G.red:dueToday?G.gold:G.muted,flexShrink:0}}>
              {overdue?"⚠ Atrasado":dueToday?"⏰ Hoje":fmt(due.toISOString().split("T")[0])}
            </span>
            <span title={s.desc} style={{color:G.muted,fontSize:13,cursor:"help",flexShrink:0}}>ℹ</span>
          </div>
        );
      })}
    </div>
  );

  const tabs=[
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"membros",icon:"👤",label:"Membros"},
    {id:"cobrancas",icon:"💰",label:"Cobranças"},
    {id:"leads",icon:"🎯",label:"Leads"},
  ];

  return(
    <div style={{background:G.bg,minHeight:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",color:G.text}}>

      {/* Settings Modal */}
      {showSettings&&(
        <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:G.card,border:`1px solid ${G.gold}50`,borderRadius:16,padding:28,maxWidth:520,width:"100%"}}>
            <div style={{color:G.gold,fontWeight:800,fontSize:16,marginBottom:6}}>⚙ Configuração — Google Sheets</div>
            <div style={{color:G.muted,fontSize:13,marginBottom:20,lineHeight:1.6}}>
              Cole aqui a URL do seu Google Apps Script.<br/>
              <strong style={{color:G.gold}}>A URL fica salva no seu navegador — não precisa configurar de novo.</strong>
            </div>
            <Input label="URL DO APPS SCRIPT" value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec"/>
            <div style={{display:"flex",gap:10,marginTop:6}}>
              <Btn label="Conectar ao Sheets" onClick={saveUrl}/>
              <Btn label="Cancelar" onClick={()=>setShowSettings(false)} variant="ghost"/>
            </div>
            {apiUrl&&<div style={{marginTop:14,padding:"8px 12px",background:G.green+"15",border:`1px solid ${G.green}40`,borderRadius:8,fontSize:12,color:G.green}}>✓ Conectado. Dados sincronizados com sua planilha.</div>}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:"#0C0C18",borderBottom:`1px solid ${G.gold}30`,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{color:G.gold,fontWeight:800,fontSize:16,letterSpacing:2}}>✦ CLUB M ALPHAVILLE</div>
          <div style={{color:G.muted,fontSize:11,marginTop:1}}>Gestão Administrativa · Secretaria</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:sc.color,flexShrink:0}}/>
            <span style={{color:sc.color,fontSize:12,fontWeight:600}}>{sc.label}</span>
          </div>
          <button onClick={()=>setShowSettings(true)} style={{background:G.gold+"20",border:`1px solid ${G.gold}50`,borderRadius:8,color:G.gold,cursor:"pointer",padding:"6px 14px",fontSize:12,fontWeight:700}}>⚙ Sheets</button>
        </div>
      </div>

      {/* No URL banner */}
      {!apiUrl&&(
        <div style={{background:G.warn+"18",borderBottom:`1px solid ${G.warn}40`,padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{color:G.warn,fontSize:13}}>⚠ Sem conexão com Google Sheets — configure para salvar os dados.</span>
          <button onClick={()=>setShowSettings(true)} style={{background:G.warn,color:"#fff",border:"none",borderRadius:6,padding:"5px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>Configurar agora</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",background:G.card,borderBottom:`1px solid ${G.border}`,overflowX:"auto"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"12px 20px",cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap",color:tab===t.id?G.gold:G.muted,background:"none",border:"none",borderBottom:tab===t.id?`2px solid ${G.gold}`:"2px solid transparent"}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:16,maxWidth:860,margin:"0 auto"}}>

        {/* ═══ DASHBOARD ═══ */}
        {tab==="dashboard"&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
            <MetCard val={metrics.totalAtend} label="Atendimentos hoje"/>
            <MetCard val={metrics.reunAgendadas} label="Reuniões agendadas" color={G.blue}/>
            <MetCard val={metrics.reunRealizadas} label="Reuniões realizadas" color={G.green}/>
            <MetCard val={metrics.noShow} label="No Show" color={G.red}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
            <MetCard val={metrics.negociacoes} label="Negociações" color={G.purple}/>
            <MetCard val={metrics.followUp} label="Follow-ups pendentes" color={G.warn}/>
            <MetCard val={metrics.vendas} label="Vendas fechadas" color={G.green}/>
            <MetCard val={members.length} label="Total membros" color={G.gold}/>
          </div>
          {metrics.overdues.length>0&&(
            <Card>
              <div style={{color:G.red,fontWeight:700,fontSize:13,marginBottom:10}}>⚠ Etapas em atraso</div>
              {metrics.overdues.slice(0,6).map((a,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"7px 10px",background:G.red+"0C",border:`1px solid ${G.red}30`,borderRadius:8,marginBottom:6,alignItems:"center"}}>
                  <span>🔴</span>
                  <div style={{flex:1}}>
                    <strong style={{color:G.red,fontSize:13}}>{a.member}</strong>
                    <span style={{color:G.muted,fontSize:12}}> — {a.step}</span>
                  </div>
                  <span style={{color:G.red,fontSize:11}}>Prazo: {fmt(a.due.toISOString().split("T")[0])}</span>
                </div>
              ))}
            </Card>
          )}
          {metrics.todayMeetings.length>0&&(
            <Card>
              <div style={{color:G.blue,fontWeight:700,fontSize:13,marginBottom:10}}>📅 Reuniões de hoje</div>
              {metrics.todayMeetings.map(l=>(
                <div key={l.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:`1px solid ${G.border}`}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:G.blue+"22",display:"flex",alignItems:"center",justifyContent:"center",color:G.blue,fontWeight:800,fontSize:14,flexShrink:0}}>{l.name[0]}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13}}>{l.name}</div>
                    <div style={{color:G.muted,fontSize:12}}>{l.company}</div>
                  </div>
                  {l.meetingResult&&<Badge label={l.meetingResult} color={l.meetingResult==="Realizada"?G.green:l.meetingResult==="No Show"?G.red:G.blue}/>}
                </div>
              ))}
            </Card>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Card>
              <div style={{color:G.gold,fontWeight:700,fontSize:13,marginBottom:12}}>👤 Onboarding em andamento</div>
              {members.filter(m=>(m.stepsCompleted?.length||0)<STEPS.length).map(m=>{
                const pct=Math.round(((m.stepsCompleted?.length||0)/STEPS.length)*100);
                return(
                  <div key={m.id} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600}}>{m.name}</span>
                      <span style={{fontSize:12,color:G.gold}}>{pct}%</span>
                    </div>
                    <div style={{background:G.border,borderRadius:10,height:5}}>
                      <div style={{background:`linear-gradient(90deg,${G.gold},${G.goldL})`,width:`${pct}%`,height:"100%",borderRadius:10}}/>
                    </div>
                  </div>
                );
              })}
              {!members.some(m=>(m.stepsCompleted?.length||0)<STEPS.length)&&<div style={{color:G.muted,fontSize:12}}>Nenhum em andamento</div>}
            </Card>
            <Card>
              <div style={{color:G.gold,fontWeight:700,fontSize:13,marginBottom:12}}>🎯 Pipeline de leads</div>
              {STAGES.map(s=>{
                const cnt=leads.filter(l=>l.stage===s.id).length;
                if(!cnt) return null;
                return(
                  <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                    <span style={{flex:1,fontSize:12}}>{s.label}</span>
                    <div style={{background:G.border,borderRadius:10,height:5,width:70}}>
                      <div style={{background:s.color,width:`${Math.min(100,cnt*25)}%`,height:"100%",borderRadius:10}}/>
                    </div>
                    <Badge label={cnt} color={s.color}/>
                  </div>
                );
              })}
            </Card>
          </div>
        </>}

        {/* ═══ MEMBROS ═══ */}
        {tab==="membros"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{color:G.gold,fontWeight:700,fontSize:15}}>Membros <span style={{color:G.muted,fontWeight:400}}>({members.length})</span></div>
            <Btn label="+ Novo Membro" onClick={()=>{setShowMForm(!showMForm);setExpandedMember(null);}}/>
          </div>
          {showMForm&&(
            <Card style={{borderColor:G.gold+"40"}}>
              <div style={{color:G.gold,fontWeight:700,fontSize:14,marginBottom:14}}>Cadastrar Novo Membro</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Input label="Nome completo *" value={mForm.name} onChange={e=>setMForm({...mForm,name:e.target.value})}/>
                <Input label="Empresa *" value={mForm.company} onChange={e=>setMForm({...mForm,company:e.target.value})}/>
                <Input label="Cargo" value={mForm.role} onChange={e=>setMForm({...mForm,role:e.target.value})}/>
                <Input label="Segmento" value={mForm.segment} onChange={e=>setMForm({...mForm,segment:e.target.value})}/>
                <Input label="E-mail" value={mForm.email} onChange={e=>setMForm({...mForm,email:e.target.value})}/>
                <Input label="Telefone" value={mForm.phone} onChange={e=>setMForm({...mForm,phone:e.target.value})}/>
                <Input label="Data de entrada" type="date" value={mForm.entryDate} onChange={e=>setMForm({...mForm,entryDate:e.target.value})}/>
                <Input label="Pagamento" value={mForm.paymentType} onChange={e=>setMForm({...mForm,paymentType:e.target.value})} options={[{v:"parcelado",l:"Parcelado"},{v:"vista",l:"À vista"}]}/>
              </div>
              <Input label="Observações" type="textarea" value={mForm.notes} onChange={e=>setMForm({...mForm,notes:e.target.value})}/>
              <div style={{display:"flex",gap:10,marginTop:4}}><Btn label="Salvar Membro" onClick={saveMember}/><Btn label="Cancelar" onClick={()=>setShowMForm(false)} variant="ghost"/></div>
            </Card>
          )}
          {members.map(m=>{
            const pct=Math.round(((m.stepsCompleted?.length||0)/STEPS.length)*100);
            const exp=expandedMember===m.id;
            const overdueCnt=STEPS.filter(s=>!m.stepsCompleted?.includes(s.id)&&addDays(m.entryDate,s.day)<today0).length;
            return(
              <Card key={m.id}>
                <div style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>setExpandedMember(exp?null:m.id)}>
                  <div style={{width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${G.gold},${G.goldL})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#08080E",fontSize:18,flexShrink:0}}>{m.name[0]}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{m.name}</div>
                    <div style={{color:G.muted,fontSize:12}}>{m.role} · {m.company}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}>
                      {m.segment&&<Badge label={m.segment} color={G.gold}/>}
                      <Badge label={m.paymentType==="vista"?"À vista":"Parcelado"} color={m.paymentType==="vista"?G.green:G.blue}/>
                      {overdueCnt>0&&<Badge label={`⚠ ${overdueCnt} atrasadas`} color={G.red}/>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{color:G.gold,fontWeight:800,fontSize:20}}>{pct}%</div>
                    <div style={{color:G.muted,fontSize:10}}>onboarding</div>
                    <div style={{color:G.muted,fontSize:10}}>Entrada {fmt(m.entryDate)}</div>
                  </div>
                  <div style={{color:G.muted,fontSize:18,flexShrink:0}}>{exp?"▲":"▼"}</div>
                </div>
                {exp&&(
                  <div style={{marginTop:16}}>
                    <div style={{background:G.border,borderRadius:10,height:6,marginBottom:18}}>
                      <div style={{background:`linear-gradient(90deg,${G.gold},${G.goldL})`,width:`${pct}%`,height:"100%",borderRadius:10}}/>
                    </div>
                    <StepBlock title="BLOCO 1 — FECHAMENTO E ATIVAÇÃO" steps={STEPS.filter(s=>s.block===1)} member={m}/>
                    <StepBlock title="BLOCO 2 — PERFIL, CARD E INTEGRAÇÃO" steps={STEPS.filter(s=>s.block===2)} member={m}/>
                    <StepBlock title="BLOCO 3 — PROGRAMA DE INDICAÇÕES" steps={STEPS.filter(s=>s.block===3)} member={m}/>
                    {m.notes&&<div style={{fontSize:12,color:G.muted,padding:"8px 10px",background:G.dim+"20",borderRadius:8,marginTop:4}}>📝 {m.notes}</div>}
                    <div style={{marginTop:12}}><Btn label="Remover membro" variant="danger" small onClick={()=>{setMembers(ms=>ms.filter(x=>x.id!==m.id));setExpandedMember(null);}}/></div>
                  </div>
                )}
              </Card>
            );
          })}
        </>}

        {/* ═══ COBRANÇAS ═══ */}
        {tab==="cobrancas"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{color:G.gold,fontWeight:700,fontSize:15}}>Cobranças <span style={{color:G.muted,fontWeight:400}}>({billings.length})</span></div>
            <Btn label="+ Registrar Contato" onClick={()=>setShowBForm(!showBForm)}/>
          </div>
          {showBForm&&(
            <Card style={{borderColor:G.gold+"40"}}>
              <div style={{color:G.gold,fontWeight:700,fontSize:14,marginBottom:14}}>Registrar Contato de Cobrança</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Input label="Nome do membro *" value={bForm.memberName} onChange={e=>setBForm({...bForm,memberName:e.target.value})}/>
                <Input label="Data do contato" type="date" value={bForm.contactDate} onChange={e=>setBForm({...bForm,contactDate:e.target.value})}/>
                <Input label="Tipo de contato" value={bForm.contactType} onChange={e=>setBForm({...bForm,contactType:e.target.value})} options={CONTACT_TYPES}/>
                <Input label="Resultado" value={bForm.result} onChange={e=>setBForm({...bForm,result:e.target.value})} placeholder="ex: Prometeu pagar até sexta"/>
              </div>
              <Input label="Observações" type="textarea" value={bForm.notes} onChange={e=>setBForm({...bForm,notes:e.target.value})}/>
              <div style={{display:"flex",gap:10,marginTop:4}}><Btn label="Salvar" onClick={saveBilling}/><Btn label="Cancelar" onClick={()=>setShowBForm(false)} variant="ghost"/></div>
            </Card>
          )}
          {[...billings].reverse().map(b=>(
            <Card key={b.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:G.warn+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💰</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:14}}>{b.memberName}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:5}}>
                      <Badge label={b.contactType} color={G.blue}/>
                      <span style={{color:G.muted,fontSize:12}}>📅 {fmt(b.contactDate)}</span>
                    </div>
                    {b.result&&<div style={{marginTop:8,fontSize:13}}><span style={{color:G.gold,fontWeight:600}}>Resultado:</span> {b.result}</div>}
                    {b.notes&&<div style={{fontSize:12,color:G.muted,marginTop:4}}>📝 {b.notes}</div>}
                  </div>
                </div>
                <button onClick={()=>setBillings(bs=>bs.filter(x=>x.id!==b.id))} style={{background:"none",border:"none",color:G.red,cursor:"pointer",fontSize:18,padding:4}}>🗑</button>
              </div>
            </Card>
          ))}
          {billings.length===0&&<Card><div style={{color:G.muted,fontSize:13,textAlign:"center",padding:24}}>Nenhum contato registrado</div></Card>}
        </>}

        {/* ═══ LEADS ═══ */}
        {tab==="leads"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{color:G.gold,fontWeight:700,fontSize:15}}>Leads — Funil <span style={{color:G.muted,fontWeight:400}}>({leads.length})</span></div>
            <Btn label="+ Novo Lead" onClick={()=>{setShowLForm(!showLForm);setEditingLead(null);setLForm(emptyLead());}}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {STAGES.map(s=>{const cnt=leads.filter(l=>l.stage===s.id).length;if(!cnt) return null;return<Badge key={s.id} label={`${s.label} (${cnt})`} color={s.color}/>;})}
          </div>
          {showLForm&&(
            <Card style={{borderColor:G.gold+"40"}}>
              <div style={{color:G.gold,fontWeight:700,fontSize:14,marginBottom:14}}>{editingLead?"Editar Lead":"Novo Lead"}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Input label="Nome *" value={lForm.name} onChange={e=>setLForm({...lForm,name:e.target.value})}/>
                <Input label="Empresa" value={lForm.company} onChange={e=>setLForm({...lForm,company:e.target.value})}/>
                <Input label="Telefone" value={lForm.phone} onChange={e=>setLForm({...lForm,phone:e.target.value})}/>
                <Input label="Etapa do funil" value={lForm.stage} onChange={e=>setLForm({...lForm,stage:e.target.value})} options={STAGES.map(s=>({v:s.id,l:s.label}))}/>
                <Input label="Data do contato" type="date" value={lForm.contactDate} onChange={e=>setLForm({...lForm,contactDate:e.target.value})}/>
                <Input label="Tipo de contato" value={lForm.contactType} onChange={e=>setLForm({...lForm,contactType:e.target.value})} options={CONTACT_TYPES}/>
                <Input label="Data da reunião" type="date" value={lForm.meetingDate} onChange={e=>setLForm({...lForm,meetingDate:e.target.value})}/>
                <Input label="Resultado da reunião" value={lForm.meetingResult} onChange={e=>setLForm({...lForm,meetingResult:e.target.value})} options={[{v:"",l:"— Sem reunião —"},...MEETING_RESULTS.map(r=>({v:r,l:r}))]}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0 10px"}}>
                <input type="checkbox" id="evo" checked={lForm.evolved} onChange={e=>setLForm({...lForm,evolved:e.target.checked})} style={{width:16,height:16,cursor:"pointer"}}/>
                <label htmlFor="evo" style={{fontSize:13,color:G.text,cursor:"pointer"}}>Evoluiu para próxima etapa?</label>
              </div>
              <Input label="Observações" type="textarea" value={lForm.notes} onChange={e=>setLForm({...lForm,notes:e.target.value})}/>
              <div style={{display:"flex",gap:10,marginTop:4}}><Btn label={editingLead?"Salvar Edição":"Salvar Lead"} onClick={saveLead}/><Btn label="Cancelar" onClick={()=>{setShowLForm(false);setEditingLead(null);}} variant="ghost"/></div>
            </Card>
          )}
          {[...leads].reverse().map(l=>{
            const stg=stageOf(l.stage);
            const exp=expandedLead===l.id;
            return(
              <Card key={l.id} style={{borderLeft:`3px solid ${stg.color}`,borderRadius:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:"pointer"}} onClick={()=>setExpandedLead(exp?null:l.id)}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div style={{fontWeight:700,fontSize:14}}>{l.name}</div>
                      <Badge label={stg.label} color={stg.color}/>
                      {l.evolved&&l.evolved!=="false"&&<Badge label="✓ Evoluiu" color={G.green}/>}
                    </div>
                    <div style={{color:G.muted,fontSize:12,marginTop:3}}>{l.company}{l.phone&&` · ${l.phone}`}</div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:6}}>
                      <span style={{color:G.muted,fontSize:11}}>📅 {fmt(l.contactDate)} · {l.contactType}</span>
                      {l.meetingDate&&<span style={{color:G.blue,fontSize:11,fontWeight:600}}>🤝 Reunião: {fmt(l.meetingDate)}</span>}
                      {l.meetingResult&&<Badge label={l.meetingResult} color={l.meetingResult==="Realizada"?G.green:l.meetingResult==="No Show"?G.red:G.blue}/>}
                    </div>
                    {l.notes&&<div style={{fontSize:11,color:G.muted,marginTop:5}}>📝 {l.notes}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0,marginLeft:10}}>
                    <button onClick={e=>{e.stopPropagation();editLead(l);}} style={{background:G.gold+"22",border:`1px solid ${G.gold}44`,borderRadius:6,color:G.gold,cursor:"pointer",fontSize:11,padding:"4px 10px",fontWeight:700}}>Editar</button>
                    <button onClick={e=>{e.stopPropagation();setLeads(ls=>ls.filter(x=>x.id!==l.id));}} style={{background:"none",border:"none",color:G.red,cursor:"pointer",fontSize:16}}>🗑</button>
                  </div>
                </div>
                {exp&&(
                  <div style={{marginTop:14}}>
                    <div style={{fontSize:11,color:G.muted,fontWeight:700,letterSpacing:1,marginBottom:8}}>MOVER PARA ETAPA:</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                      {STAGES.map(s=>(
                        <button key={s.id} onClick={e=>{e.stopPropagation();setLeads(ls=>ls.map(x=>x.id===l.id?{...x,stage:s.id}:x));}}
                          style={{background:l.stage===s.id?s.color:s.color+"18",color:l.stage===s.id?"#08080E":s.color,border:`1px solid ${s.color}44`,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div style={{fontSize:11,color:G.muted,fontWeight:700,letterSpacing:1,marginBottom:8}}>RESULTADO DA REUNIÃO:</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {MEETING_RESULTS.map(r=>(
                        <button key={r} onClick={e=>{e.stopPropagation();setLeads(ls=>ls.map(x=>x.id===l.id?{...x,meetingResult:r}:x));}}
                          style={{background:l.meetingResult===r?(r==="Realizada"?G.green:r==="No Show"?G.red:G.blue):"#ffffff0A",color:l.meetingResult===r?"#fff":G.muted,border:`1px solid ${G.dim}`,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:600}}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          {leads.length===0&&<Card><div style={{color:G.muted,fontSize:13,textAlign:"center",padding:24}}>Nenhum lead cadastrado</div></Card>}
        </>}
      </div>
    </div>
  );
}
