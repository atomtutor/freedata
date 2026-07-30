// state.js
const state = {
  data: [],
  schema: null, // { idKey, timeKey, categorical:[{key,values}], numeric:[key,...] }
  version: 0,    // setData가 호출될 때마다 1씩 증가 (각 탭이 "최신 데이터로 그려졌는지" 비교하는 기준)
  setData(rows, schema) {
    this.data = rows;
    this.schema = schema || this.schema;
    this.version++;
    document.dispatchEvent(new CustomEvent('dataUpdated', { detail: { rows: this.data, schema: this.schema } }));
  }
};
