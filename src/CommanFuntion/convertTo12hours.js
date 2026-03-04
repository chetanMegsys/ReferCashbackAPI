const formatTo12Hour = (dateString) => {
  const date = new Date(dateString);

  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-IN", { month: "short" });
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");

  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours === 0 ? 12 : hours;

  const formattedHours = String(hours).padStart(2, "0");

  return `${day} ${month} ${year} ${formattedHours}:${minutes}${ampm}`;
};

module.exports = { formatTo12Hour };
