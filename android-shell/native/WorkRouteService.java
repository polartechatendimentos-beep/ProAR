package br.com.proar.mobile;

import android.app.*;
import android.content.*;
import android.location.*;
import android.os.*;
import android.webkit.CookieManager;
import android.util.Base64;
import com.getcapacitor.JSObject;
import org.json.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

public class WorkRouteService extends Service implements LocationListener {
 private static final String PREF="proar_work_route", HOST="https://polartech.proar.online";
 private static final ExecutorService NETWORK=Executors.newSingleThreadExecutor();
 private static WorkRouteService running;
 private LocationManager locations;
 private long lastPoint=0;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREF,Context.MODE_PRIVATE);}
 private static JSONObject queue(Context c){try{return new JSONObject(prefs(c).getString("queue","{}"));}catch(Exception e){return new JSONObject();}}
 private static void save(Context c,JSONObject q){prefs(c).edit().putString("queue",q.toString()).commit();}
 public static synchronized void prepare(Context c,String id,String expires,String username)throws Exception{
  JSONObject q=queue(c);JSONArray points=q.optJSONArray("points");
  if(!id.equals(q.optString("routeId")) && ((points!=null&&points.length()>0)||q.optBoolean("finishPending")))throw new Exception("Sincronize a jornada anterior antes de iniciar outra.");
  long deadline=Instant.parse(expires).toEpochMilli();
  if(deadline<=System.currentTimeMillis() || deadline>System.currentTimeMillis()+12*3600000L)throw new Exception("Jornada expirada.");
  if(q.optBoolean("finishPending"))throw new Exception("O encerramento anterior aguarda sincronização.");
  q.put("routeId",id).put("expires",deadline).put("username",username).put("error","");
  if(points==null)q.put("points",new JSONArray());save(c,q);
 }
 public static JSObject status(Context c){JSONObject q=queue(c);JSObject result=new JSObject();result.put("active",running!=null);result.put("pending",q.optJSONArray("points")==null?0:q.optJSONArray("points").length());result.put("error",q.optString("error"));return result;}
 public static void stopCollection(Context c){if(running!=null)running.stopNow();else markFinish(c);flushAsync(c);}
 private static synchronized void markFinish(Context c){JSONObject q=queue(c);if(q.optString("routeId").isEmpty())return;try{q.put("finishPending",true);if(!q.has("finishId"))q.put("finishId",UUID.randomUUID().toString());save(c,q);}catch(Exception ignored){}}
 @Override public void onCreate(){super.onCreate();running=this;locations=(LocationManager)getSystemService(LOCATION_SERVICE);}
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  if(intent!=null&&"STOP".equals(intent.getAction())){stopNow();flushAsync(this);return START_NOT_STICKY;}
  NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
  manager.createNotificationChannel(new NotificationChannel("work-route","Localização de trabalho",NotificationManager.IMPORTANCE_LOW));
  PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,WorkRouteService.class).setAction("STOP"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  PendingIntent open=PendingIntent.getActivity(this,2,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  Notification notice=new Notification.Builder(this,"work-route").setContentTitle("ProAR • Localização de trabalho ativa").setContentText("Coleta durante a jornada. Toque em Encerrar para parar.").setSmallIcon(android.R.drawable.ic_menu_mylocation).setOngoing(true).setContentIntent(open).addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel,"Encerrar rota",stop).build()).build();
  startForeground(4101,notice);
  try{for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER})if(locations.isProviderEnabled(provider))locations.requestLocationUpdates(provider,60000,0,this,Looper.getMainLooper());}
  catch(SecurityException e){stopNow();return START_NOT_STICKY;}
  handler.post(tick);return START_NOT_STICKY;
 }
 private final Runnable tick=new Runnable(){public void run(){JSONObject q=queue(WorkRouteService.this);if(System.currentTimeMillis()>q.optLong("expires")){stopNow();flushAsync(WorkRouteService.this);return;}flushAsync(WorkRouteService.this);handler.postDelayed(this,60000);}};
 @Override public void onLocationChanged(Location l){
  if(System.currentTimeMillis()-lastPoint<60000 || l.getTime()<System.currentTimeMillis()-120000)return;
  lastPoint=System.currentTimeMillis();
  synchronized(WorkRouteService.class){JSONObject q=queue(this);if(lastPoint>q.optLong("expires")){stopNow();return;}try{JSONArray points=q.optJSONArray("points");if(points==null)points=new JSONArray();if(points.length()>=1500){q.put("error","Limite local atingido. Sincronize antes de continuar.");save(this,q);stopNow();return;}points.put(new JSONObject().put("id",UUID.randomUUID().toString()).put("capturedAt",Instant.ofEpochMilli(l.getTime()).toString()).put("latitude",l.getLatitude()).put("longitude",l.getLongitude()).put("accuracy",l.getAccuracy()));q.put("points",points);save(this,q);}catch(Exception ignored){}}
  flushAsync(this);
 }
 private void stopNow(){locations.removeUpdates(this);handler.removeCallbacks(tick);markFinish(this);stopForeground(STOP_FOREGROUND_REMOVE);running=null;stopSelf();}
 @Override public void onDestroy(){locations.removeUpdates(this);handler.removeCallbacks(tick);running=null;super.onDestroy();}
 @Override public IBinder onBind(Intent intent){return null;}
 private static String sessionCookie(String expected)throws Exception{
  String cookies=CookieManager.getInstance().getCookie(HOST);if(cookies==null)throw new Exception("Sessão indisponível; coleta pausada.");
  for(String part:cookies.split(";")){String pair=part.trim();if(!pair.startsWith("proar_session="))continue;String token=pair.substring(14);String[] pieces=token.split("\\.");if(pieces.length!=3 || !"v2".equals(pieces[0]))throw new Exception("Reentre no ProAR para sincronizar.");JSONObject payload=new JSONObject(new String(Base64.decode(pieces[1],Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING),StandardCharsets.UTF_8));if(!expected.equals(payload.optString("username"))||payload.optLong("exp")*1000<=System.currentTimeMillis())throw new Exception("Sessão do colaborador encerrada; coleta pausada.");return pair;}
  throw new Exception("Sessão indisponível; coleta pausada.");
 }
 public static void flushAsync(Context c){Context app=c.getApplicationContext();NETWORK.execute(()->flush(app));}
 private static void flush(Context c){
  try{for(int batch=0;batch<35;batch++){
   JSONObject q;JSONArray points=new JSONArray();String id;boolean finishing;
   synchronized(WorkRouteService.class){q=queue(c);JSONArray all=q.optJSONArray("points");JSONArray retained=new JSONArray();if(all!=null)for(int i=0;i<all.length();i++){JSONObject p=all.getJSONObject(i);if(Instant.parse(p.getString("capturedAt")).toEpochMilli()>=System.currentTimeMillis()-24*3600000L)retained.put(p);}q.put("points",retained);save(c,q);for(int i=0;i<Math.min(50,retained.length());i++)points.put(retained.getJSONObject(i));id=q.optString("routeId");finishing=points.length()==0&&q.optBoolean("finishPending");if(id.isEmpty()||(!finishing&&points.length()==0))return;}
   if(q.has("inflight")){JSONObject flight=q.getJSONObject("inflight");finishing=flight.getString("action").equals("finish");points=flight.optJSONArray("points");if(points==null)points=new JSONArray();}
   String cookie=sessionCookie(q.getString("username"));
   JSONObject body=new JSONObject().put("routeId",id).put("action",finishing?"finish":"points").put("requestId",finishing?q.getString("finishId"):points.getJSONObject(0).getString("id"));if(!finishing)body.put("points",points);
   synchronized(WorkRouteService.class){JSONObject current=queue(c);if(current.has("inflight"))body=current.getJSONObject("inflight");else{current.put("inflight",body);save(c,current);}}
   HttpURLConnection connection=(HttpURLConnection)new URL(HOST+"/api/work-routes").openConnection();connection.setInstanceFollowRedirects(false);connection.setRequestMethod("POST");connection.setConnectTimeout(15000);connection.setReadTimeout(15000);connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");connection.setRequestProperty("Cookie",cookie);
   int code;String result;try{connection.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));code=connection.getResponseCode();if(code!=200)throw new Exception("Sincronização recusada ("+code+"). Verifique sessão e jornada.");result=new String(connection.getInputStream().readAllBytes(),StandardCharsets.UTF_8);}finally{connection.disconnect();}
   if(!new JSONObject(result).optBoolean("saved"))throw new Exception("Gravação não confirmada.");
   synchronized(WorkRouteService.class){JSONObject latest=queue(c);if(!id.equals(latest.optString("routeId")))return;if(finishing){prefs(c).edit().remove("queue").commit();return;}JSONArray all=latest.optJSONArray("points"), remaining=new JSONArray();for(int i=0;i<all.length();i++){JSONObject p=all.getJSONObject(i);boolean sent=false;for(int j=0;j<points.length();j++)if(p.getString("id").equals(points.getJSONObject(j).getString("id")))sent=true;if(!sent)remaining.put(p);}latest.remove("inflight");latest.put("points",remaining).put("error","");save(c,latest);}
  }}catch(Exception e){synchronized(WorkRouteService.class){JSONObject q=queue(c);try{q.put("error",e.getMessage());save(c,q);}catch(Exception ignored){}}if(e.getMessage()!=null&&(e.getMessage().contains("Sessão")||e.getMessage().contains("sessão")||e.getMessage().contains("recusada"))){WorkRouteService service=running;if(service!=null)service.handler.post(service::stopNow);}}
 }
}
