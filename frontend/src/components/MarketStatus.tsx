"use client";

import { useEffect, useState } from "react";
import styles from "./Toolbar.module.css";

interface NYParts {
  weekday: string;
  hour: number;
  minute: number;
  second: string;
}

function getNYParts(date: Date): NYParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: get("second"),
  };
}

// Regular trading hours only (9:30am-4:00pm ET, Mon-Fri). Doesn't account
// for NYSE holidays.
function isMarketOpen({ weekday, hour, minute }: NYParts): boolean {
  if (weekday === "Sat" || weekday === "Sun") return false;
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= 9 * 60 + 30 && minutesSinceMidnight < 16 * 60;
}

export default function MarketStatus() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // The real clock only starts after mount -- rendering Date.now() during
    // the initial render would differ between server and client and cause a
    // hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className={styles.marketStatusGroup}>
        <span className={styles.logo}>QuantDesk</span>
        <span className={styles.marketStatus}>
          <span className={styles.statusDot} />
          NYSE
        </span>
        <span className={styles.clock}>NY --:--:--</span>
      </div>
    );
  }

  const parts = getNYParts(now);
  const open = isMarketOpen(parts);
  const time = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${parts.second}`;

  return (
    <div className={styles.marketStatusGroup}>
      <span className={styles.logo}>QuantDesk</span>
      <span className={`${styles.marketStatus} ${open ? styles.marketOpen : styles.marketClosed}`}>
        <span className={styles.statusDot} />
        NYSE {open ? "OPEN" : "CLOSE"}
      </span>
      <span className={styles.clock}>NY {time}</span>
    </div>
  );
}
