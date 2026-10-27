export function mobileWeekDates(day:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return [];
  const date=new Date(`${day}T12:00:00Z`);if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==day)return [];
  date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
  return Array.from({length:7},(_,index)=>{const value=new Date(date);value.setUTCDate(value.getUTCDate()+index);return value.toISOString().slice(0,10);});
}
