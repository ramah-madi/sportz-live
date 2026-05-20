import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";
import { Request, Response, NextFunction } from "express";

 const arcjetKey = process.env.ARCJET_KEY;
if (!arcjetKey && process.env.NODE_ENV === "production") {
  throw new Error("ARCJET_KEY is required in production");
}
if (!arcjetKey) {
  console.warn("[security] ARCJET_KEY not set; Arcjet protection is disabled");
}

// 'DRY_RUN' is a mode that used to see what would be blocked without actually blocking it
const arcjetMode = process.env.ARCJET_MODE === 'DRY_RUN' ? 'DRY_RUN' : 'LIVE';

export const httpArcjet = arcjetKey ? arcjet({
    key: arcjetKey,
    rules: [
        shield({
          mode: arcjetMode  
        }),
        detectBot({
            mode: arcjetMode,
            allow: ['CATEGORY:SEARCH_ENGINE', "CATEGORY:PREVIEW"],
        }),
        slidingWindow({mode: arcjetMode, interval: '10s', max: 50})
    ]
}) : null;

export const wspArcjet = arcjetKey ? arcjet({
    key: arcjetKey,
    rules: [
        shield({
          mode: arcjetMode  
        }),
        detectBot({
            mode: arcjetMode,
            allow: ['CATEGORY:SEARCH_ENGINE', "CATEGORY:PREVIEW"],
        }),
        slidingWindow({mode: arcjetMode, interval: '2s', max: 5}) // allow 5 connections in 2s
    ]
}) : null;

export function securityMiddleware(){
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!httpArcjet) return next();

        try {
            const decision = await httpArcjet.protect(req);
            if (decision.isDenied()) {
                if (decision.reason.isRateLimit()) {
                    return res.status(429).json({error: 'Too many requests'});
                } else {
                    return res.status(403).json({error: 'Forbidden'});
                }
            }
        } catch (error) {
            console.error('Arcjet middleware error:', error);
            return res.status(503).json({error: 'Service Unavailable'});
        }      
        
        next();
    }
} 