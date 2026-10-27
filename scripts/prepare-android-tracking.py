from pathlib import Path
import shutil
import xml.etree.ElementTree as ET
root=Path('android/app/src/main')
java=root/'java/br/com/proar/mobile'
java.mkdir(parents=True,exist_ok=True)
for name in ['WorkRoutePlugin.java','WorkRouteService.java']:
    shutil.copyfile(Path('android-shell/native')/name,java/name)
activity=java/'MainActivity.java'
s=activity.read_text()
if 'registerPlugin(WorkRoutePlugin.class)' not in s:
    s=s.replace('public class MainActivity extends BridgeActivity {}','public class MainActivity extends BridgeActivity {\n @Override public void onCreate(android.os.Bundle savedInstanceState) { registerPlugin(WorkRoutePlugin.class); super.onCreate(savedInstanceState); }\n}')
    if 'registerPlugin(WorkRoutePlugin.class)' not in s: raise RuntimeError('MainActivity inesperada; registro do plugin não aplicado')
    activity.write_text(s)
ns='http://schemas.android.com/apk/res/android';ET.register_namespace('android',ns)
p=root/'AndroidManifest.xml';tree=ET.parse(p);manifest=tree.getroot()
for perm in ['ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION','FOREGROUND_SERVICE','FOREGROUND_SERVICE_LOCATION','POST_NOTIFICATIONS']:
    name='android.permission.'+perm
    if not any(x.get('{'+ns+'}name')==name for x in manifest.findall('uses-permission')):
        ET.SubElement(manifest,'uses-permission',{'{'+ns+'}name':name})
app=manifest.find('application')
app.set('{'+ns+'}allowBackup','false')
if not any(x.get('{'+ns+'}name')=='.WorkRouteService' for x in app.findall('service')):
    ET.SubElement(app,'service',{'{'+ns+'}name':'.WorkRouteService','{'+ns+'}exported':'false','{'+ns+'}foregroundServiceType':'location','{'+ns+'}stopWithTask':'false'})
tree.write(p,encoding='utf-8',xml_declaration=True)
