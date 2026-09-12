const fs = require('fs');
const path = 'c:/Users/Bello Imam/Downloads/zeneva/src/app/(app)/ai-insights/page.tsx';

let c = fs.readFileSync(path, 'utf8');

c = c.replace(/return \(\s*<Dialog open=\{isOpen\} onOpenChange=\{onOpenChange\}>/g, `return (
        <>
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-40 pointer-events-auto animate-in fade-in duration-200" 
                    onClick={() => onOpenChange(false)} 
                />
            )}
            <Dialog open={isOpen} onOpenChange={onOpenChange} modal={false}>`);

c = c.replace(/<\/Dialog>\s*\)/g, `</Dialog>
        </>
    )`);

fs.writeFileSync(path, c);
console.log('Done!');
