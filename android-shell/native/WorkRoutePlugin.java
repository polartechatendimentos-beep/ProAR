package br.com.proar.mobile;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name="WorkRoute", permissions={
 @Permission(alias="location", strings={Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION}),
 @Permission(alias="notifications", strings={Manifest.permission.POST_NOTIFICATIONS})
})
public class WorkRoutePlugin extends Plugin {
 private boolean trusted(PluginCall call) {
  String url=getBridge().getWebView().getUrl();
  if(url==null || !url.startsWith("https://polartech.proar.online/")){call.reject("Origem não autorizada.");return false;}return true;
 }
 @PluginMethod public void start(PluginCall call){
  if(!trusted(call))return;
  if(getPermissionState("location")!=PermissionState.GRANTED){requestPermissionForAlias("location",call,"locationReady");return;}
  locationReady(call);
 }
 @PermissionCallback private void locationReady(PluginCall call){
  if(getPermissionState("location")!=PermissionState.GRANTED){call.reject("Permita a localização para iniciar a rota.");return;}
  if(Build.VERSION.SDK_INT>=33 && getPermissionState("notifications")!=PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"notificationReady");return;}
  notificationReady(call);
 }
 @PermissionCallback private void notificationReady(PluginCall call){
  if(Build.VERSION.SDK_INT>=33 && getPermissionState("notifications")!=PermissionState.GRANTED){call.reject("Ative notificações para tornar a coleta visível.");return;}
  String id=call.getString("routeId",""), expires=call.getString("expiresAt",""), username=call.getString("username","");
  if(!id.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-zA-Z0-9-]{8,80}") || username.isEmpty()){call.reject("Jornada inválida.");return;}
  try{
   WorkRouteService.prepare(getContext(),id,expires,username);
   Intent intent=new Intent(getContext(),WorkRouteService.class).setAction("START");
   getContext().startForegroundService(intent);call.resolve();
  }catch(Exception e){call.reject(e.getMessage());}
 }
 @PluginMethod public void position(PluginCall call){
  if(!trusted(call))return;
  if(getPermissionState("location")!=PermissionState.GRANTED){call.reject("Inicie a coleta para autorizar o GPS.");return;}
  android.location.LocationManager manager=(android.location.LocationManager)getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
  String provider=manager.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)?android.location.LocationManager.GPS_PROVIDER:android.location.LocationManager.NETWORK_PROVIDER;
  android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());
  java.util.concurrent.atomic.AtomicBoolean done=new java.util.concurrent.atomic.AtomicBoolean(false);
  android.location.LocationListener listener=new android.location.LocationListener(){public void onLocationChanged(android.location.Location location){if(!done.compareAndSet(false,true))return;manager.removeUpdates(this);JSObject point=new JSObject();point.put("id",java.util.UUID.randomUUID().toString());point.put("capturedAt",java.time.Instant.ofEpochMilli(location.getTime()).toString());point.put("latitude",location.getLatitude());point.put("longitude",location.getLongitude());point.put("accuracy",location.getAccuracy());call.resolve(point);}};
  try{manager.requestSingleUpdate(provider,listener,android.os.Looper.getMainLooper());handler.postDelayed(()->{manager.removeUpdates(listener);if(done.compareAndSet(false,true))call.reject("GPS sem atualização. Verifique o sinal e tente novamente.");},20000);}catch(Exception e){call.reject("GPS indisponível: "+e.getMessage());}
 }
 @PluginMethod public void stop(PluginCall call){if(!trusted(call))return;WorkRouteService.stopCollection(getContext());call.resolve();}
 @PluginMethod public void sync(PluginCall call){if(!trusted(call))return;WorkRouteService.flushAsync(getContext());call.resolve();}
 @PluginMethod public void status(PluginCall call){if(!trusted(call))return;call.resolve(WorkRouteService.status(getContext()));}
}
