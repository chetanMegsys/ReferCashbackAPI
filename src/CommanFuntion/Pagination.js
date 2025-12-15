const paginateArray = ({
  data = [],
  page = 1,
  limit = 5,
  isPagination = false,
}) => {
  if (!isPagination) {
    return {
      data,
      pagination: null,
    };
  }

  page = Number(page);
  limit = Number(limit);

  const totalRecords = data.length;
  const totalPages = Math.ceil(totalRecords / limit);
  const start = (page - 1) * limit;

  return {
    data: data.slice(start, start + limit),
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
