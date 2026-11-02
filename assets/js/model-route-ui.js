/* Request-scoped warnings; no background tasks, network probes or global overlays. */
var ModelRouteUI=(function(){
  'use strict';
  function element(tag,className,text){var el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
  function rows(audit){
    var list=element('dl','model-route-values');
    var models=Array.isArray(audit.reportedModels)?audit.reportedModels.slice(0,24).filter(function(m){return typeof m==='string';}).map(function(m){return m.slice(0,200);}):[];
    [['调用模型',typeof audit.requestedModel==='string'?audit.requestedModel.slice(0,200):'未记录'],['接口报告模型',models.length?models.join('、'):'未披露，无法核验']].forEach(function(row){
      var wrap=element('div');wrap.appendChild(element('dt','',row[0]));wrap.appendChild(element('dd','',row[1]));list.appendChild(wrap);
    });return list;
  }
  function record(audit){
    if(!audit||audit.version!==1)return null;
    var details=element('details','model-route-record'+(['conflict','mismatch'].includes(audit.status)?' is-mismatch':''));
    details.appendChild(element('summary','','模型核对 · '+({conflict:'响应标识冲突',mismatch:'标识不一致',match:'返回标识一致',unverified:'无法核验'}[audit.status]||'无法核验')));
    details.appendChild(rows(audit));
    if(audit.observedModel)details.appendChild(element('p','model-route-note','采用的响应标识：'+audit.observedModel));
    if(audit.conflict)details.appendChild(element('p','model-route-note','同一次请求中，接口报告了不同模型标识。'));
    details.appendChild(element('p','model-route-note','依据接口返回的元数据核对；不能识别未披露或被改写的内部路由。模型别名或版本解析也可能导致标识变化。'));
    if(Array.isArray(audit.evidence)&&audit.evidence.length)details.appendChild(element('p','model-route-note','字段来源：'+[...new Set(audit.evidence.slice(0,24).filter(function(e){return e&&typeof e.source==='string';}).map(function(e){return e.source.slice(0,120);}))].join('、')));
    return details;
  }
  function notify(audit){
    if(!audit||!['conflict','mismatch'].includes(audit.status))return;
    var old=document.getElementById('model-route-warning');if(old)old.remove();
    var warning=element('section','model-route-warning');warning.id='model-route-warning';warning.setAttribute('role','alert');
    var heading=element('div','model-route-warning-heading');heading.appendChild(element('strong','','模型路由警告'));
    var close=element('button','','关闭 ×');close.type='button';close.setAttribute('aria-label','关闭模型路由警告');close.onclick=function(){warning.remove();};heading.appendChild(close);
    warning.appendChild(heading);warning.appendChild(rows(audit));
    warning.appendChild(element('p','model-route-note',audit.status==='conflict'?'本轮响应包含互相冲突的模型标识，请核对渠道记录。':'调用模型与接口报告模型不一致，请核对渠道路由或模型别名。'));
    (document.getElementById('notifications-container')||document.body).appendChild(warning);
  }
  return {record:record,notify:notify};
})();
