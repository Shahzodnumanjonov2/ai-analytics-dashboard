// app.js — ECharts dashboard (robust counts, paging-friendly)
(async function () {
  const Api = window.Api;
  const U   = window.Utils;
  const E   = echarts;

  const rangeSelect = document.getElementById('rangeSelect');
  const refreshBtn  = document.getElementById('refreshBtn');

  // --------- small helpers ----------
  let chart = {};
  function mount(id, option){
    const el = document.getElementById(id);
    if (!el) return;
    if (chart[id]) chart[id].dispose();
    const inst = E.init(el, null, { renderer:'canvas' });
    inst.setOption(option, true);
    chart[id] = inst;
  }
  const areaSeries = (name, data)=>({ name, type:'line', data, smooth:true, areaStyle:{}, symbol:'none' });
  const barSeries  = (name, data, stack=null)=>{ const s={name,type:'bar',data}; if(stack)s.stack=stack; return s; };
  const pieOption  = (title, pairs)=>({
    title:{text:title,left:'center',textStyle:{color:'#cfe1ff',fontSize:14}},
    tooltip:{trigger:'item'},
    legend:{bottom:0,textStyle:{color:'#cbd5e1'}},
    series:[{type:'pie',radius:['35%','70%'],data:(pairs||[]).map(([n,v])=>({name:n,value:v}))}]
  });

  // Graceful fallbacks (yangi Api bo'lmasa ham ishlaydi)
  const fetchUsersAll   = Api.fetchUsersAll   || Api.fetchUsers;
  const fetchRatingsAll = Api.fetchRatingsAll || Api.fetchRatings;
  const fetchAisumAll   = Api.fetchAisumAll;
  const countUsersExact = Api.countUsersExact || (async () => {
    const r = await Api.fetchUsers(); if (r.error) throw r.error; return (r.data||[]).length;
  });
  const countAIMsgExact = Api.countAIMsgExact || (async () => {
    const a = await Api.fetchAisumAll(); if (a.error) throw a.error;
    return (a.data||[]).filter(x => x.ai_message && String(x.ai_message).trim()!=='').length;
  });

  async function load(){
    const days = Number(rangeSelect.value);

    // --- Parallel pulls (robust) ---
    const [usersRes, aisumRes, ratingsRes, totalUsers, totalAIMsgs] = await Promise.all([
      fetchUsersAll(),
      fetchAisumAll(),
      fetchRatingsAll(),
      countUsersExact(),
      countAIMsgExact(),
    ]);

    // normalize .data
    const users    = usersRes?.data   ?? usersRes   ?? [];
    const aisumAll = aisumRes?.data   ?? aisumRes   ?? [];
    const ratings  = ratingsRes?.data ?? ratingsRes ?? [];

    // filter last N days for aisum
    const aisum = (aisumAll||[]).filter(r => r.created_at && U.inLastNDays(r.created_at, days));

    // ===== KPIs =====
    // Avg rating (weighted by rating_all)
    let votes=0, weighted=0;
    (ratings||[]).forEach(r => { const v=Number(r.rating_all)||0; const a=Number(r.average)||0; votes+=v; weighted+=v*a; });
    const avgRating  = votes ? (weighted/votes).toFixed(2) : '—';
    const activeUsers= new Set(aisum.map(x => x.chat_id)).size;

    // Render KPI cards
    document.getElementById('kpiAvgRating')   .textContent = String(avgRating);
    document.getElementById('kpiRatingVotes') .textContent = `${votes} votes`;
    document.getElementById('kpiUsers')       .textContent = String(totalUsers ?? 0);
    document.getElementById('kpiActiveUsers') .textContent = String(activeUsers);
    document.getElementById('kpiActiveRange') .textContent = `last ${days}d`;
    document.getElementById('kpiAIMsgs')      .textContent = String(totalAIMsgs ?? 0);

    // ===== Common labels (use once!) =====
    const labels = U.lastNDaysLabels(days);

    // ===== Users section =====
    // Active users per day (distinct chat_id)
    const dauMap = Object.fromEntries(labels.map(d=>[d,new Set()]));
    aisum.forEach(r => { const k = U.toDay(r.created_at); if (k in dauMap) dauMap[k].add(r.chat_id); });
    const dau = labels.map(d => dauMap[d].size);
    mount('u_active_ts', {
      tooltip:{trigger:'axis'},
      xAxis:{type:'category', data:labels, axisLabel:{color:'#94a3b8'}},
      yAxis:{type:'value', axisLabel:{color:'#94a3b8'}},
      grid:{left:40,right:20,top:20,bottom:30},
      series:[areaSeries('Active users', dau)]
    });

    // Gender pie (from users.gender)
    const genderPairs = U.countBy(users, u => (u.gender||'unknown'));
    mount('u_gender_pie', pieOption('Gender', genderPairs));

    // Language pie
    const langPairs = U.countBy(users, u => (u.lan||'unknown'));
    mount('u_lang_pie', pieOption('Language', langPairs));

    // Place top-10
    const placeTop = U.countBy(users, u => (u.place||'unknown')).slice(0,10).reverse();
    mount('u_place_bar', {
      tooltip:{}, grid:{left:100,right:20,top:10,bottom:20},
      xAxis:{type:'value', axisLabel:{color:'#94a3b8'}},
      yAxis:{type:'category', data: placeTop.map(x=>x[0]), axisLabel:{color:'#94a3b8'}},
      series:[barSeries('Users', placeTop.map(x=>x[1]))]
    });

    // Age groups
    const ages = U.binAges(users); const ageLabels = Object.keys(ages); const ageVals = ageLabels.map(k=>ages[k]);
    mount('u_age_bar', {
      tooltip:{}, grid:{left:40,right:20,top:10,bottom:30},
      xAxis:{type:'category', data: ageLabels, axisLabel:{color:'#94a3b8'}},
      yAxis:{type:'value', axisLabel:{color:'#94a3b8'}},
      series:[barSeries('Users', ageVals)]
    });

    // ===== Rating section =====
    // Histogram of averages (bucket 0.5)
    const avgs = (ratings||[]).map(r=>Number(r.average)).filter(v=>!isNaN(v));
    const bins = new Map(); const step=0.5;
    avgs.forEach(v=>{ const b=(Math.floor(v/step)*step).toFixed(1); bins.set(b,(bins.get(b)||0)+1); });
    const histLabels = [...bins.keys()].map(Number).sort((a,b)=>a-b).map(v=>v.toFixed(1));
    const histVals   = histLabels.map(l=>bins.get(Number(l))||0);
    mount('r_hist', {
      tooltip:{}, xAxis:{type:'category', data:histLabels, axisLabel:{color:'#94a3b8'}},
      yAxis:{type:'value', axisLabel:{color:'#94a3b8'}}, grid:{left:40,right:20,top:10,bottom:30},
      series:[barSeries('Users', histVals)]
    });

    // Top engaged (chat_count)
    const engaged = [...(ratings||[])].sort((a,b)=>(b.chat_count||0)-(a.chat_count||0)).slice(0,10).reverse();
    mount('r_top_chatters', {
      tooltip:{}, grid:{left:140,right:20,top:10,bottom:20},
      xAxis:{type:'value', axisLabel:{color:'#94a3b8'}},
      yAxis:{type:'category', data: engaged.map(r=>r.name||'user'), axisLabel:{color:'#94a3b8'}},
      series:[barSeries('Chats', engaged.map(r=>r.chat_count||0))]
    });

    // Top satisfied / dissatisfied
    const rated  = (ratings||[]).filter(r=>!isNaN(Number(r.average)));
    const topSat = [...rated].sort((a,b)=>(b.average||0)-(a.average||0)).slice(0,5);
    const topDis = [...rated].sort((a,b)=>(a.average||0)-(b.average||0)).slice(0,5);
    mount('r_top_avg', {
      tooltip:{}, legend:{bottom:0,textStyle:{color:'#cbd5e1'}},
      grid:{left:120,right:20,top:10,bottom:30},
      xAxis:{type:'value', axisLabel:{color:'#94a3b8'}},
      yAxis:{type:'category',
        data:[...topSat.map(r=>'😊 '+(r.name||'user')),...topDis.map(r=>'😕 '+(r.name||'user'))].reverse(),
        axisLabel:{color:'#94a3b8'}},
      series:[barSeries('Avg', [...topSat.map(r=>r.average||0), ...topDis.map(r=>r.average||0)].reverse())]
    });

    // ===== AISum section =====
    // AI messages per day
    const aiPerDay = Object.fromEntries(labels.map(d=>[d,0]));
    aisum.forEach(r => {
      if (r.ai_message && String(r.ai_message).trim()!==''){
        const k = U.toDay(r.created_at);
        if (k in aiPerDay) aiPerDay[k]++;
      }
    });
    mount('a_msgs_ts', {
      tooltip:{trigger:'axis'}, xAxis:{type:'category', data:labels, axisLabel:{color:'#94a3b8'}},
      yAxis:{type:'value', axisLabel:{color:'#94a3b8'}}, grid:{left:40,right:20,top:20,bottom:30},
      series:[areaSeries('AI msg/day', labels.map(d=>aiPerDay[d]))]
    });

    // Topic stacked (Top 7)
    const topicPairs  = U.countBy(aisum.filter(r=>r.topic), r=>r.topic).slice(0,7);
    const topicKeys   = topicPairs.map(x=>x[0]);
    const topicSeries = topicKeys.map(t=>{
      const m = Object.fromEntries(labels.map(d=>[d,0]));
      aisum.filter(r=>r.topic===t).forEach(r=>{ const k=U.toDay(r.created_at); if(k in m) m[k]++; });
      return barSeries(t, labels.map(d=>m[d]), 'topic');
    });
    mount('a_topic_stack', {
      tooltip:{trigger:'axis'}, legend:{bottom:0,textStyle:{color:'#cbd5e1'}},
      xAxis:{type:'category', data:labels, axisLabel:{color:'#94a3b8'}},
      yAxis:{type:'value', axisLabel:{color:'#94a3b8'}}, grid:{left:40,right:20,top:10,bottom:40},
      series: topicSeries
    });

    // Doctor bar
    const doctorTop = U.countBy(aisum.filter(r=>r.doctor), r=>r.doctor).slice(0,10).reverse();
    mount('a_doctor_bar', {
      tooltip:{}, grid:{left:140,right:20,top:10,bottom:20},
      xAxis:{type:'value', axisLabel:{color:'#94a3b8'}},
      yAxis:{type:'category', data:doctorTop.map(x=>x[0]), axisLabel:{color:'#94a3b8'}},
      series:[barSeries('Messages', doctorTop.map(x=>x[1]))]
    });

    // Peak hours (UTC)
    const hours = Array.from({length:24},(_,h)=>h);
    const hourCount = Array(24).fill(0);
    aisum.forEach(r => { const h = new Date(r.created_at).getUTCHours(); hourCount[h]++; });
    mount('a_peak_hours', {
      tooltip:{}, grid:{left:40,right:20,top:10,bottom:30},
      xAxis:{type:'category', data:hours.map(h=>`${h}:00`), axisLabel:{color:'#94a3b8'}},
      yAxis:{type:'value', axisLabel:{color:'#94a3b8'}},
      series:[barSeries('Msgs', hourCount)]
    });
  }

  refreshBtn.addEventListener('click', load);
  rangeSelect.addEventListener('change', load);
  try { await load(); } catch(e){ console.error(e); alert('Data load error: ' + (e?.message || e)); }
})();