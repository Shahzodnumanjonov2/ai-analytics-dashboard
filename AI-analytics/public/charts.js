window.SupaCharts = (()=>{
  const mkLine = (ctx, labels, series)=> new Chart(ctx, { type:'line', data:{ labels, datasets: series }, options:{ responsive:true, maintainAspectRatio:false, tension:.35, plugins:{ legend:{labels:{color:'#cbd5e1'}}, tooltip:{} }, scales:{ x:{ ticks:{color:'#94a3b8'}}, y:{ ticks:{color:'#94a3b8'}, grid:{color:'rgba(255,255,255,.06)'} } } } });
  const mkBar = (ctx, labels, data, label)=> new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label, data }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{labels:{color:'#cbd5e1'}} }, scales:{ x:{ ticks:{color:'#94a3b8'}}, y:{ ticks:{color:'#94a3b8'}, grid:{color:'rgba(255,255,255,.06)'} } } } });
  const mkDoughnut = (ctx, labels, data)=> new Chart(ctx, { type:'doughnut', data:{ labels, datasets:[{ data }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{labels:{color:'#cbd5e1'}} } } });
  return { mkLine, mkBar, mkDoughnut };
})();