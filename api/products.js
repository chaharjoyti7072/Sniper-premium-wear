const { getJSON, putJSON } = require("../_store");

function auth(req) {
  return (
    !!process.env.ADMIN_PASSWORD &&
    req.headers.authorization ===
      `Bearer ${process.env.ADMIN_PASSWORD}`
  );
}

module.exports = async (req, res) => {
  try {

    /* =========================
       GET PRODUCTS
    ========================= */

    if (req.method === "GET") {

      return res.status(200).json({
        products:
          await getJSON("products", [])
      });

    }


    /* =========================
       ADMIN AUTH
    ========================= */

    if (!auth(req)) {

      return res.status(401).json({
        error: "Unauthorized"
      });

    }


    /* =========================
       ADD / EDIT PRODUCT
    ========================= */

    if (
      req.method === "POST" ||
      req.method === "PUT"
    ) {

      const body =
        req.body || {};


      /* PRODUCT NAME */

      if (!body.name) {

        return res.status(400).json({
          error:
            "Product name is required"
        });

      }


      /* PRICE */

      if (
        !Number.isFinite(
          Number(body.price)
        ) ||
        Number(body.price) <= 0
      ) {

        return res.status(400).json({
          error:
            "Valid price is required"
        });

      }


      const list =
        await getJSON(
          "products",
          []
        );


      /* =========================
         IMAGES
      ========================= */

      let images = [];


      /*
        New 5-photo system
      */

      if (
        Array.isArray(body.images)
      ) {

        images =
          body.images
            .filter(Boolean)
            .map(function(image) {
              return String(image).trim();
            })
            .filter(Boolean);

      }


      /*
        Support old photos field
      */

      if (
        Array.isArray(body.photos)
      ) {

        images = [
          ...images,
          ...body.photos
            .filter(Boolean)
            .map(function(image) {
              return String(image).trim();
            })
            .filter(Boolean)
        ];

      }


      /*
        Support old main image
      */

      const oldImg =
        String(
          body.img || ""
        ).trim();


      if (
        oldImg &&
        !images.includes(oldImg)
      ) {

        images.unshift(oldImg);

      }


      /*
        Remove duplicate images
        and keep maximum 5
      */

      images = [
        ...new Set(images)
      ].slice(0, 5);


      /*
        Main image is always
        first image
      */

      const mainImage =
        images.length
        ? images[0]
        : "";


      /* =========================
         PRODUCT OBJECT
      ========================= */

      const product = {

        id:
          Number(body.id) ||
          Date.now(),


        name:
          String(
            body.name
          ).trim(),


        category:
          String(
            body.category || ""
          ).trim(),


        /*
          Featured ON / OFF
        */

        featured:
          body.featured === true ||
          body.featured === "true",


        price:
          Math.round(
            Number(body.price)
          ),


        sizes:
          String(
            body.sizes || ""
          ).trim(),


        fabric:
          String(
            body.fabric || ""
          ).trim(),


        /*
          Main image
        */

        img:
          mainImage,


        /*
          Maximum 5 product photos
        */

        images:
          images,


        description:
          String(
            body.description ||
            "Premium quality"
          ).trim()

      };


      /* =========================
         UPDATE / ADD
      ========================= */

      let updatedList;


      if (
        req.method === "PUT"
      ) {

        updatedList =
          list.map(function(item) {

            /*
              Keep old images if
              editing product without
              selecting new photos.
            */

            if (
              item.id === product.id &&
              images.length === 0
            ) {

              return {
                ...item,

                ...product,

                img:
                  item.img || "",

                images:
                  Array.isArray(item.images)
                  ? item.images
                  : (
                      item.img
                      ? [item.img]
                      : []
                    )
              };

            }


            return (
              item.id === product.id
              ? product
              : item
            );

          });


      } else {

        updatedList = [
          ...list,
          product
        ];

      }


      /* =========================
         SAVE
      ========================= */

      await putJSON(
        "products",
        updatedList
      );


      return res.status(200).json({
        products:
          updatedList
      });

    }


    /* =========================
       DELETE PRODUCT
    ========================= */

    if (
      req.method === "DELETE"
    ) {

      const id =
        Number(
          req.query.id
        );


      const list =
        await getJSON(
          "products",
          []
        );


      const updatedList =
        list.filter(function(item) {

          return item.id !== id;

        });


      await putJSON(
        "products",
        updatedList
      );


      return res.status(200).json({
        products:
          updatedList
      });

    }


    /* =========================
       METHOD NOT ALLOWED
    ========================= */

    return res.status(405).json({
      error:
        "Method not allowed"
    });


  } catch (error) {

    console.error(
      "Products API error:",
      error
    );


    return res.status(500).json({
      error:
        error.message ||
        "Server error"
    });

  }
};
