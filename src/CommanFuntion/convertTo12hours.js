const formatTo12Hour = (dateString) => {
  const date = new Date(dateString);

  const options = {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  const parts = new Intl.DateTimeFormat("en-IN", options).formatToParts(date);

  const day = parts.find((p) => p.type === "day").value;
  const month = parts.find((p) => p.type === "month").value;
  const year = parts.find((p) => p.type === "year").value;
  const hour = parts.find((p) => p.type === "hour").value;
  const minute = parts.find((p) => p.type === "minute").value;
  const ampm = parts.find((p) => p.type === "dayPeriod").value.toLowerCase();

  return `${day} ${month} ${year} ${hour}:${minute}${ampm}`;
};

module.exports = { formatTo12Hour };
