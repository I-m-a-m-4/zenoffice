
import fs from 'fs';

const logoSvg = `
<svg width='700' height='350' viewBox='0 0 350 175' xmlns='http://www.w3.org/2000/svg'>
<style>text { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 500; }</style>
<defs>
<linearGradient id='sharedOrangeGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
<stop offset='0%' style='stop-color:#ff9933;stop-opacity:1' />
<stop offset='100%' style='stop-color:#cc5200;stop-opacity:1' />
</linearGradient>
<filter id='dropShadow' x='-20%' y='-20%' width='140%' height='140%'>
<feGaussianBlur in='SourceAlpha' stdDeviation='1'/>
<feOffset dx='0' dy='1' result='offsetblur'/>
<feComponentTransfer>
<feFuncA type='linear' slope='0.3'/>
</feComponentTransfer>
<feMerge>
<feMergeNode/>
<feMergeNode in='SourceGraphic'/>
</feMerge>
</filter>
</defs>
<g transform='translate(-15, 5) scale(0.85)'>
<path d='M 100 55 A 35 35 0 1 0 100 125 A 35 35 0 1 0 100 55 Z M 100 63 A 27 27 0 1 1 100 117 A 27 27 0 1 1 100 63 Z' fill='url(#sharedOrangeGradient)' stroke='url(#sharedOrangeGradient)' stroke-width='0.5' filter='url(#dropShadow)' />
<path d='M 60 127 Q 100 154 140 127 Q 100 142 60 127 Z' fill='url(#sharedOrangeGradient)' stroke='url(#sharedOrangeGradient)' stroke-width='0.5' filter='url(#dropShadow)' />
</g>
<text x='115' y='115' fill='url(#sharedOrangeGradient)' font-size='75' letter-spacing='-1'>zeneva</text>
</svg>
`;

const iconSvg = `
<svg width='400' height='400' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'>
<defs>
<linearGradient id='zenevaOrangeGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
<stop offset='0%' style='stop-color:#ff9933;stop-opacity:1' />
<stop offset='100%' style='stop-color:#cc5200;stop-opacity:1' />
</linearGradient>
<filter id='dropShadow' x='-20%' y='-20%' width='140%' height='140%'>
<feGaussianBlur in='SourceAlpha' stdDeviation='1.5'/>
<feOffset dx='0' dy='2' result='offsetblur'/>
<feComponentTransfer>
<feFuncA type='linear' slope='0.3'/>
</feComponentTransfer>
<feMerge>
<feMergeNode/>
<feMergeNode in='SourceGraphic'/>
</feMerge>
</filter>
</defs>
<g filter='url(#dropShadow)'>
<path d='M 100 55 A 35 35 0 1 0 100 125 A 35 35 0 1 0 100 55 Z M 100 63 A 27 27 0 1 1 100 117 A 27 27 0 1 1 100 63 Z' fill='url(#zenevaOrangeGradient)' stroke='#cc5200' stroke-width='0.5' />
<path d='M 60 127 Q 100 154 140 127 Q 100 142 60 127 Z' fill='url(#zenevaOrangeGradient)' stroke='#cc5200' stroke-width='0.5' />
</g>
</svg>
`;

const logoBase64 = Buffer.from(logoSvg.trim()).toString('base64');
const iconBase64 = Buffer.from(iconSvg.trim()).toString('base64');

console.log('Logo:', `data:image/svg+xml;base64,${logoBase64}`);
console.log('Icon:', `data:image/svg+xml;base64,${iconBase64}`);
