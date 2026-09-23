import test from 'node:test';
import assert from 'node:assert/strict';
import {captureForecasts,forecastHistory} from '../forecast-history.mjs';

test('first saved forecasts survive later actual results and include empty predictions',()=>{
 const children=[{id:'1'}],visits=['2026-09-01','2026-09-04','2026-09-07'].map(date=>({date,child:'1'}));
 const first=captureForecasts(children,visits,'2026-09-07');
 assert.equal(Object.keys(first).length,28);
 assert.deepEqual(first['2026-09-10'],{issuedOn:'2026-09-07',predicted:['1']});
 assert.deepEqual(first['2026-09-08'].predicted,[]);
 const updated=captureForecasts(children,[...visits,{date:'2026-09-08',child:'1'}],'2026-09-08',first);
 assert.deepEqual(updated['2026-09-10'],first['2026-09-10']);
 assert.equal(Object.keys(first).length,28);
 assert.equal(Object.keys(updated).length,29);
});

test('missing forecasts, unrecorded days and confirmed empty days remain distinct',()=>{
 const visits=[{date:'2026-09-01',child:'1'}];
 const history={'2026-09-02':{issuedOn:'2026-09-01',predicted:['1']},'2026-09-03':{issuedOn:'2026-09-01',predicted:[]}};
 const rows=forecastHistory(visits,['2026-09-02'],history,'2026-09-03');
 assert.equal(rows[0].date,'2026-09-03');
 assert.equal(rows[0].confirmed,false);
 assert.deepEqual(rows[0].predicted,[]);
 assert.equal(rows[1].confirmed,true);
 assert.deepEqual(rows[1].actual,[]);
 assert.equal(rows[2].predicted,null);
 assert.equal(rows[2].confirmed,true);
});
