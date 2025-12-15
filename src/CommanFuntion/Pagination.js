// const paginateArray = ({
//   data = [],
//   page = 1,
//   limit = 5,
//   isPagination = false,
// }) => {
//   if (!isPagination) {
//     return {
//       data,
//       pagination: null,
//     };
//   }

//   page = Number(page);
//   limit = Number(limit);

//   const totalRecords = data.length;
//   const totalPages = Math.ceil(totalRecords / limit);
//   const start = (page - 1) * limit;

//   return {
//     data: data.slice(start, start + limit),
//     pagination: {
//       page,
//       limit,
//       totalRecords,
//       totalPages,
//       hasNextPage: page < totalPages,
//       hasPrevPage: page > 1,
//     },
//   };
// };

const paginateArray = ({
  data = [],
  page = 1,
  limit = 5,
  isPagination = false,
  search = "",
  searchKeys = [],
}) => {
  // 🔍 Apply search FIRST
  let filteredData = data;

  if (search && searchKeys.length > 0) {
    const searchLower = search?.toLowerCase();

    filteredData = data.filter((item) =>
      searchKeys.some((key) => {
        const value = key
          .split(".")
          .reduce((obj, k) => (obj ? obj[k] : null), item);

        return (
          typeof value === "string" && value.toLowerCase().includes(searchLower)
        );
      })
    );
  }

  if (!isPagination) {
    return {
      data: filteredData,
      pagination: null,
    };
  }

  page = Number(page);
  limit = Number(limit);

  const totalRecords = filteredData.length;
  const totalPages = Math.ceil(totalRecords / limit);
  const start = (page - 1) * limit;

  return {
    data: filteredData.slice(start, start + limit),
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

module.exports = { paginateArray };
