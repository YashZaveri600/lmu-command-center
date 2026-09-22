import React from 'react'
import { ArrowUpRight } from 'lucide-react'
export default function Brand() {
  return <a className="es-brand" href="/?welcome=1" aria-label="EduSync home"><span className="es-brand-mark" aria-hidden="true"><ArrowUpRight size={23} strokeWidth={2.5}/></span>edusync<span className="es-brand-dot">.</span></a>
}
