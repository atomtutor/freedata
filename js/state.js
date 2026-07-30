// state.js
const state = {
  data: [],
  schema: null, // { idKey, timeKey, categorical:[{key,values}], numeric:[key,...] }
  setData(rows, schema) {
    this.data = rows;
    this.schema = schema || this.schema;
    document.dispatchEvent(new CustomEvent('dataUpdated', { detail: { rows: this.data, schema: this.schema } }));
  }
};
