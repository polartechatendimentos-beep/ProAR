/** The URL selects the product interface. Viewport, user agent and old cookies never select field mode. */
export function isMobileInterfacePath(pathname:string):boolean {
 return pathname==='/mobile'||pathname.startsWith('/mobile/');
}
