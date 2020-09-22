import placeholderImg from "@assets/images/placeholder255x255.png";
import LeaveScreenDialog from "@saleor/components/LeaveScreenDialog";
import NotFoundPage from "@saleor/components/NotFoundPage";
import { WindowTitle } from "@saleor/components/WindowTitle";
import useNavigator from "@saleor/hooks/useNavigator";
import useNotifier from "@saleor/hooks/useNotifier";
import useShop from "@saleor/hooks/useShop";
import { commonMessages } from "@saleor/intl";
import createDialogActionHandlers from "@saleor/utils/handlers/dialogActionHandlers";
import createMetadataUpdateHandler from "@saleor/utils/handlers/metadataUpdateHandler";
import {
  useMetadataUpdate,
  usePrivateMetadataUpdate
} from "@saleor/utils/metadata/updateMetadata";
import { useWarehouseList } from "@saleor/warehouses/queries";
import { warehouseListPath } from "@saleor/warehouses/urls";
import React, { useEffect, useState } from "react";
import { useIntl } from "react-intl";

import { decimal, weight } from "../../misc";
import ProductVariantDeleteDialog from "../components/ProductVariantDeleteDialog";
import ProductVariantPage, {
  ProductVariantPageSubmitData,
  ProductVariantPageSubmitNextAction
} from "../components/ProductVariantPage";
import {
  useProductVariantReorderMutation,
  useVariantDeleteMutation,
  useVariantImageAssignMutation,
  useVariantImageUnassignMutation,
  useVariantUpdateMutation
} from "../mutations";
import { useProductVariantQuery } from "../queries";
import { VariantUpdate_productVariantUpdate_errors } from "../types/VariantUpdate";
import {
  productUrl,
  productVariantAddUrl,
  productVariantEditUrl,
  ProductVariantEditUrlDialog,
  ProductVariantEditUrlQueryParams
} from "../urls";
import { mapFormsetStockToStockInput } from "../utils/data";
import { createVariantReorderHandler } from "./ProductUpdate/handlers";

interface ProductUpdateProps {
  variantId: string;
  productId: string;
  params: ProductVariantEditUrlQueryParams;
}

export const ProductVariant: React.FC<ProductUpdateProps> = ({
  variantId,
  productId,
  params
}) => {
  const { action } = params;
  const shop = useShop();
  const navigate = useNavigator();
  const notify = useNotifier();
  const intl = useIntl();
  const [errors, setErrors] = useState<
    VariantUpdate_productVariantUpdate_errors[]
  >([]);
  useEffect(() => {
    setErrors([]);
  }, [variantId]);

  const warehouses = useWarehouseList({
    displayLoader: true,
    variables: {
      first: 50
    }
  });

  const { data, loading } = useProductVariantQuery({
    displayLoader: true,
    variables: {
      id: variantId
    }
  });
  const [updateMetadata] = useMetadataUpdate({});
  const [updatePrivateMetadata] = usePrivateMetadataUpdate({});

  const [openModal, closeModal] = createDialogActionHandlers<
    ProductVariantEditUrlDialog,
    ProductVariantEditUrlQueryParams
  >(
    navigate,
    params => productVariantEditUrl(productId, variantId, params),
    params
  );

  const handleBack = () => navigate(productUrl(productId));

  const [assignImage, assignImageOpts] = useVariantImageAssignMutation({});
  const [unassignImage, unassignImageOpts] = useVariantImageUnassignMutation(
    {}
  );
  const [deleteVariant, deleteVariantOpts] = useVariantDeleteMutation({
    onCompleted: () => {
      notify({
        status: "success",
        text: intl.formatMessage({
          defaultMessage: "Variant removed"
        })
      });
      navigate(productUrl(productId));
    }
  });
  const [updateVariant, updateVariantOpts] = useVariantUpdateMutation({
    onCompleted: data => {
      if (data.productVariantUpdate.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(commonMessages.savedChanges)
        });
      } else {
        setErrors(data.productVariantUpdate.errors);
      }
    }
  });

  const variant = data?.productVariant;

  if (variant === null) {
    return <NotFoundPage onBack={handleBack} />;
  }

  const [
    reorderProductVariants,
    reorderProductVariantsOpts
  ] = useProductVariantReorderMutation({});

  const handleVariantReorder = createVariantReorderHandler(
    variant?.product,
    variables => reorderProductVariants({ variables })
  );

  const disableFormSave =
    loading ||
    deleteVariantOpts.loading ||
    updateVariantOpts.loading ||
    assignImageOpts.loading ||
    unassignImageOpts.loading ||
    reorderProductVariantsOpts.loading;

  const handleImageSelect = (id: string) => () => {
    if (variant) {
      if (variant?.images?.map(image => image.id).indexOf(id) !== -1) {
        unassignImage({
          variables: {
            imageId: id,
            variantId: variant.id
          }
        });
      } else {
        assignImage({
          variables: {
            imageId: id,
            variantId: variant.id
          }
        });
      }
    }
  };

  const handleUpdate = async (data: ProductVariantPageSubmitData) => {
    const result = await updateVariant({
      variables: {
        addStocks: data.addStocks.map(mapFormsetStockToStockInput),
        attributes: data.attributes.map(attribute => ({
          id: attribute.id,
          values: [attribute.value]
        })),
        costPrice: decimal(data.costPrice),
        id: variantId,
        price: decimal(data.price),
        removeStocks: data.removeStocks,
        sku: data.sku,
        stocks: data.updateStocks.map(mapFormsetStockToStockInput),
        trackInventory: data.trackInventory,
        weight: weight(data.weight)
      }
    });

    return [
      ...result.data?.productVariantStocksCreate.errors,
      ...result.data?.productVariantStocksDelete.errors,
      ...result.data?.productVariantStocksUpdate.errors,
      ...result.data?.productVariantUpdate.errors
    ];
  };
  const handleSubmit = createMetadataUpdateHandler(
    data?.productVariant,
    handleUpdate,
    variables => updateMetadata({ variables }),
    variables => updatePrivateMetadata({ variables })
  );

  const [submitNextAction, setSubmitNextAction] = React.useState<
    ProductVariantPageSubmitNextAction
  >(null);
  const handleSubmitNextAction = (
    nextAction?: ProductVariantPageSubmitNextAction
  ) => {
    const action = nextAction || submitNextAction;
    if (action === "warehouse-configure") {
      navigate(warehouseListPath);
    }
  };

  return (
    <>
      <WindowTitle title={data?.productVariant?.name} />
      <ProductVariantPage
        defaultWeightUnit={shop?.defaultWeightUnit}
        errors={errors}
        saveButtonBarState={updateVariantOpts.status}
        loading={disableFormSave}
        placeholderImage={placeholderImg}
        variant={variant}
        header={variant?.name || variant?.sku}
        warehouses={
          warehouses.data?.warehouses.edges.map(edge => edge.node) || []
        }
        onAdd={() => navigate(productVariantAddUrl(productId))}
        onBack={handleBack}
        onDelete={() => openModal("remove")}
        onImageSelect={handleImageSelect}
        onSubmit={async (data, nextAction) => {
          const errors = await handleSubmit(data);
          if (errors?.length === 0) {
            handleSubmitNextAction(nextAction);
          } else {
            setSubmitNextAction(null);
          }
        }}
        onSubmitSkip={handleSubmitNextAction}
        onVariantClick={variantId => {
          navigate(productVariantEditUrl(productId, variantId));
        }}
        onVariantReorder={handleVariantReorder}
      />
      <ProductVariantDeleteDialog
        confirmButtonState={deleteVariantOpts.status}
        onClose={() => navigate(productVariantEditUrl(productId, variantId))}
        onConfirm={() =>
          deleteVariant({
            variables: {
              id: variantId
            }
          })
        }
        open={params.action === "remove"}
        name={data?.productVariant?.name}
      />
      <LeaveScreenDialog
        onSaveChanges={() => navigate(warehouseListPath)}
        onRejectChanges={() => navigate(warehouseListPath)}
        onClose={closeModal}
        open={action === "leave-screen"}
        confirmButtonState="default"
      />
    </>
  );
};
export default ProductVariant;
