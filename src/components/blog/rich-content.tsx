
import { CheckCircle2, HelpCircle, Lightbulb } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"; 

export function DirectAnswerBox({ answer }: { answer: string }) {
    if (!answer) return null;
    return (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 my-8 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-primary font-bold text-lg">
                <Lightbulb className="w-5 h-5" />
                <h3>Quick Answer</h3>
            </div>
            <p className="text-lg font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                {answer}
            </p>
        </div>
    );
}

export function ComparisonTable({ data }: { data: { title: string; headers: string[]; rows: string[][] } }) {
    if (!data) return null;
    return (
        <div className="my-10 overflow-hidden border rounded-xl shadow-sm">
            <div className="bg-slate-100 dark:bg-slate-800 p-4 font-bold text-center border-b font-bricolage text-lg">
                {data.title}
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        {data.headers.map((header, i) => (
                            <TableHead key={i} className={`font-bold ${i === 0 ? 'w-[30%]' : ''}`}>
                                {header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.rows.map((row, i) => (
                        <TableRow key={i}>
                            {row.map((cell, j) => (
                                <TableCell key={j} className={j === 0 ? 'font-medium' : ''}>
                                    {cell}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export function FAQSection({ faq }: { faq: { question: string; answer: string }[] }) {
    if (!faq || faq.length === 0) return null;

    // Generate JSON-LD for FAQPage
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faq.map(item => ({
            "@type": "Question",
            "name": item.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
            }
        }))
    };

    return (
        <section className="my-12">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <h3 className="text-2xl font-bold font-bricolage mb-6 flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-primary" />
                Personally Asked Questions (PAQ)
            </h3>
            <Accordion type="single" collapsible className="w-full">
                {faq.map((item, i) => (
                    <AccordionItem key={i} value={`item-${i}`}>
                        <AccordionTrigger className="text-left text-lg font-medium hover:text-primary">
                            {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                            {item.answer}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </section>
    );
}
