/* Response-model observation adapted from Sub2API upstream_response_model.go. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ModelRouteCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const terminalEvents = new Set(['response.completed','response.done','response.failed','response.incomplete','response.cancelled','response.canceled']);
  function name(value) {
    return typeof value === 'string' ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g,'').trim()).slice(0,200).join('') : '';
  }
  function comparable(value) {
    return value.toLowerCase().replace(/^models\//, '').replace(/^(grok-4\.[567])(?:-build|-latest)$/, '$1');
  }
  function create(requested, backend) {
    requested = name(requested);
    const evidence = [];
    let priority = -1, selected = '', conflict = false;
    function add(value, source, rank, terminal) {
      const model = name(value);
      if (!model) return;
      if (rank > priority) { priority = rank; selected = ''; conflict = false; }
      if (rank === priority) {
        if (selected && selected.toLowerCase() !== model.toLowerCase()) conflict = true;
        if (!selected || terminal) selected = model;
      }
      if (!evidence.some(e => e.model === model && e.source === source)) {
        if (evidence.length === 24) {
          const weak = evidence.findIndex(e => e.rank < rank);
          if (weak < 0 && rank < priority) return;
          evidence.splice(weak < 0 ? 0 : weak, 1);
        }
        evidence.push({model, source, rank});
      }
    }
    function observe(data, eventType) {
      if (!data || typeof data !== 'object') return;
      const nested = data.response;
      const versions = [[data.modelVersion,'response.modelVersion'],[nested?.modelVersion,'response.response.modelVersion'],[nested?.response?.modelVersion,'response.response.response.modelVersion']];
      const version = versions.find(([value]) => name(value));
      if (version) add(version[0], version[1], 1, true);
      for (const key of ['actualModel','actual_model','upstream_model','model_version']) {
        add(data[key], 'response.' + key, 1, false);
        add(data.metadata?.[key], 'response.metadata.' + key, 1, false);
      }
      add(data.metadata?.modelVersion, 'response.metadata.modelVersion', 1, false);
      if (name(nested?.model)) add(nested.model, 'response.response.model', 0, terminalEvents.has(eventType || data.type));
      else if (backend === 'anthropic' && name(data.message?.model)) add(data.message.model, 'response.message.model', 0, false);
      else add(data.model, 'response.model', 0, terminalEvents.has(eventType || data.type));
    }
    function headers(value) {
      if (typeof value?.get !== 'function') return;
      for (const key of ['x-actual-model','x-upstream-model','x-model-version']) add(value.get(key),'header.' + key,1,false);
    }
    function result() {
      const models = [...new Set(evidence.filter(e => e.rank === priority).map(e => e.model))];
      const status = !requested || !selected ? 'unverified' : comparable(selected) !== comparable(requested) ? 'mismatch' : conflict ? 'conflict' : 'match';
      return {version:1, requestedModel:requested, observedModel:selected, conflict, reportedModels:models, status,
        evidence:evidence.map(({model, source}) => ({model, source}))};
    }
    return {observe, headers, result};
  }
  return {create};
});
