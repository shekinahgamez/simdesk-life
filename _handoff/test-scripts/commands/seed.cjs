const SID='29cca42f-4851-4674-a59f-c9133d5592c3';
const SAVE={"name":"Grown Folks Save","color":"#ADA2FF","cover":null,"packs":["get-to-work","get-together","city-living","cats-and-dogs","seasons","get-famous","island-living","discover-university","eco-lifestyle","snowy-escape","cottage-living","high-school-years","growing-together","horse-ranch","for-rent","lovestruck","life-and-death","businesses-and-hobbies","enchanted-by-nature","adventure-awaits","royalty-and-legacy","vampires","parenthood","jungle-adventure","strangerville","realm-of-magic","werewolves","spa-day","dine-out","outdoor-retreat"],"today":0,"modules":{"rotation":true},"calendar":{"anchorDay":0,"anchorDate":{"day":12,"year":1,"season":0},"seasonLength":21},"lifespan":{"days":{"teen":105,"adult":420,"child":168,"elder":525,"infant":19,"newborn":2,"toddler":84,"youngAdult":462},"preset":"custom"},"realAges":true,"trackDate":true,"customDays":{"teen":105,"adult":420,"child":168,"elder":525,"infant":19,"newborn":2,"toddler":84,"youngAdult":462},"secretLots":[]};
const HH={"4782e179-bd45-4205-a681-5306199d4c7d":"Coriana","2ba8ae06-801b-34f8-1c6c-2bd8d57f92dd":"Adebayo","cd6ced80-6ff9-c597-791e-f3b9b38e54f2":"Baptiste","98de77d9-5312-4825-42bc-60a6286cc8f1":"Bree’s Spot","c666d716-d7b0-c942-8404-dc8816391c17":"Charm Royale","c04ca6b7-a419-8036-c3d6-3b0d706079fe":"Chas + Dom","96ba32c5-a0f0-dd34-c6db-a537a3bc00c8":"Dwayne & Dre","42a5373d-5fad-8d82-55e0-a8e167019bb5":"Hunt","3a263802-0e18-c774-612c-54d20d4d4d21":"Jacobs","ae3acd14-9b1f-a2cd-968b-1280d2129d93":"Melanna","bd4e6ae4-2cd7-7aa5-4f84-696e4f5d0a47":"Nai Vex","31a0c1d7-8ede-5d68-4125-84a51203f40c":"Navarro","55f45c76-b94e-949f-f3f5-28e639f3ff72":"NBA Bad Boy","2d60f4a8-fefa-e5d3-2799-4f1713e472e4":"Osborne","5056d802-6c5e-a304-9c79-671c6a49385d":"Priestley","c1734144-7795-914d-3eac-b64d6934a786":"Reeves","5572cb13-dfc8-6fff-82ad-4e4cf5b1b347":"Sorenson","f9b9b9c1-35c2-a19a-b78c-8253484322a9":"The 4Ever House","842a01ac-af70-bc44-3558-0506177d914e":"Vaughn","1cc2761f-f860-a2a7-42b1-c710f39c2067":"Vranic","2957f205-e69b-2b6f-aebb-4794254fc9c8":"Whitfield"};
const P=(id,cx,cy,zoom)=>({h:640,w:640,id,crop:{cx,cy,zoom}});
// [id, first, last, gender, bornDay, householdKey(prefix), portrait]
const S=[
['c208ae97-1e4b-472e-9c9d-36bc4bd441f7','Cori','Fletcher','female',-640,'4782',P('545ff9ea-76d9-44a4-874e-97c9a905af59',0.52,0.38,2.37)],
['6d700e82-63fa-496e-b183-b35787852e05','Kiana','Carter','female',-690,'4782',P('2847bd1d-ea96-4537-8112-2e1d7c16d708',0.51,0.42,2.2)],
['27957465-33a3-4213-5e6b-e94f88d92e96','Bree','Washington','female',-650,'98de'],
['305183b4-5cbc-f961-1667-252008a6d6ce','Chasity','Boyd','female',-432,'c04c'],
['d579570a-6bf3-ebee-b389-22b37c5ee994','Dominic "Dom"','Porter','male',-514,'c04c'],
['0fb186c7-e96b-0cf2-acea-31605ad931d5','Montrell','Rhodes','male',-568,'55f4'],
['232f6191-b16a-e8d6-33db-e5b0f18ce4c0','Micah','Whitfield','male',-623,null],
['b675b660-b328-3e07-b1a2-93e1e389883a','Whitney','Sorenson','female',-609,'5572'],
['a1a9706d-5d44-44bc-341a-c589e0c2807b','Femi','Adebayo','female',-890,'2ba8'],
['580e29fd-341e-467a-731a-0a93b087e81e','Danika','Reeves',null,-1050,'c173'],
['56597665-fa03-8f62-3f58-47424037f2ba','Reggie','Voss','male',-1050,null],
['7484d1ff-16bc-a84a-c461-cbe3bb4e79f7','Adriana','Navarro','female',-650,'31a0'],
['f4d3fa89-3e96-404e-a908-8133c5925e29','Marcus','Whitfield','male',-958,'2957'],
['523667d2-711f-c2e1-6632-943e62a5a991','Naima','Achebe','female',-487,'bd4e'],
['ee86d25d-647e-81d6-9ffa-5246d2f5e633','Kwame','Adebayo','male',-941,'2ba8'],
['76d67c72-5f7c-1240-1776-b8e47849bbdf','Luka','Vranić','male',-595,'1cc2'],
['931e16ff-cd9f-59c9-b9b1-402ef0e220f5','Kai','Osborne','male',-432,'2d60'],
['852aa94c-ca2c-ce85-0ab1-1995fa7d69e7','Jamar','Priestley','male',-890,'5056'],
['538f4ec2-615e-1317-7437-204043514362','Kendra','Priestley','female',-758,'5056'],
['42c5948f-89b9-816f-c2b8-4b7a9807f67b','Noelle','Baptiste','female',-890,'cd6c'],
['96b91a47-c922-0a00-a85e-315edea64cef','Shanice','Trammell','female',-595,null],
['4399e23f-37e9-ec94-1ebc-a8f729be499e','Amari','Trammell','male',-77,null],
['3db981df-e628-840a-d4ac-cbfadf5f8a2a','Rosalind "Roz"','Broussard','female',-1193,null],
['449db357-9a4d-2f8c-4597-20881122fcd2','Isaiah','Rowe','male',-731,null],
['c10a9ac7-df3a-1af3-6bce-346b2a2b7167','Nia','Rowe','female',-124,null],
['996bd834-137a-9dc6-1d68-4dbee71522db','Dwayne','Millsap','male',-677,'96ba'],
['ffa129b3-b275-305e-ccae-a2ac2fb4bf1c','Amaya','Wyatt','female',-609,'f9b9'],
['ff0c95d0-96c1-da77-b2ee-20faf5832a38','Devin','Charles','male',-609,'f9b9'],
['be635457-ce15-db1e-db0e-bf02d993985f','Charmaine','Boone','female',-731,'c666'],
['40fc2548-c338-4bc2-5bf9-a4be5b157625','Amara','Jacobs','female',-1050,'3a26'],
['9b473440-f7af-5fc4-b96e-cf7b227aef66','Bryson','Priestley','male',-161,'5056'],
['e529183f-9423-d09d-41fe-6ce56deba361','Blair','Priestley','female',-217,'5056'],
['bed66ba6-f0c4-7226-142c-d129acfad6e2','Bronx','Navarro','male',-21,'31a0'],
['b75f3ec1-5581-9095-7426-201077c11954','Mele','Malu','female',-609,'ae3a'],
['b8c64b9f-3e45-bd09-0632-ebf13ba84758','Quentin','Ellis','male',-541,'2d60'],
['6f79291b-622c-f971-0e76-ab03e22b082d','Destiny','Hunt','female',-609,'42a5'],
['4a7b6b8a-07f2-d49e-6026-6518b0f20bd5','Shanae','Vaughn','female',-568,'842a',P('3ac3ac2f-10d0-4b01-9d48-06b39ae92255',0.52,0.44,1.93)],
['f0e00f52-0030-02bd-affb-0b1f76ba8474','Kamille','Vaughn','female',-77,'842a',P('b0df204d-036d-4b7c-95a4-7da0ccca0faa',0.5,0.5,2.45)],
];
const PORTRAIT_IDS=S.filter(s=>s[6]).map(s=>s[6].id);
function seed(st){ const now=new Date().toISOString();
 st.saves[SID]={id:SID,data:SAVE,edited_at:now,deleted_at:null,created_at:now};
 const R=(id,kind,data)=>({id,save_id:SID,kind,data,edited_at:now,deleted_at:null,created_at:now});
 const hhId=(k)=>k?Object.keys(HH).find(x=>x.startsWith(k)):null;
 const recs=[
  ...Object.entries(HH).map(([id,name])=>R(id,'household',{name,notes:'',home:id.startsWith('4782')?{id:'7e70ee8e-9871-45ed-9990-ee33b1baa4c8',kind:'lot',unit:'fba05f95-a7e6-4e45-86c4-b21998d86753'}:null})),
  R("02fe9db1-1f8a-4a5b-a27c-74bbc05d31c9","world",{"name":"Lennox Park","vibe":"","gameId":"newcrest","inspiredBy":""}),
  R("7e70ee8e-9871-45ed-9990-ee33b1baa4c8","lot",{"name":"13 & 14 Vantage Park","size":"30x20","spot":"newcrest--fern-park","type":"residential-rental","notes":"","owner":null,"photo":null,"price":null,"units":[{"id":"a9da363c-4283-4e91-8c3d-560c00e5b971","name":"13 Vantage Park"},{"id":"fba05f95-a7e6-4e45-86c4-b21998d86753","name":"14 Vantage Park"}],"traits":[],"credits":"Simkhira","history":[],"meantFor":null}),
  ...S.map(([id,first,last,gender,bornDay,hk,portrait])=>R(id,'sim',{first,last,gender,bornDay,addedDay:0,stage:null,career:'',occult:null,traits:[],deceased:null,portrait:portrait||null,pronouns:'',aspiration:null,careerLevel:null,householdId:hhId(hk),orientation:'',stagePhotos:[],genderSettings:{},notes:id.startsWith('c208')?'Met Kiana at the Spice Festival. Wants a big wedding by the water.\nSaving up for the house on Vantage Park.':''})),
 ];
 st.records[SID]={}; for(const r of recs) st.records[SID][r.id]=r;
 st.account={data:{"prefs":{"birthdayView":"date"},"customTraits":[]},edited_at:now};
 return SID;}
module.exports={seed,SID,PORTRAIT_IDS};
