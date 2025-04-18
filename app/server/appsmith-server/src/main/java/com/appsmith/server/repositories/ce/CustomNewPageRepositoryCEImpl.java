package com.appsmith.server.repositories.ce;

import com.appsmith.server.acl.AclPermission;
import com.appsmith.server.constants.FieldName;
import com.appsmith.server.domains.NewPage;
import com.appsmith.server.domains.QLayout;
import com.appsmith.server.domains.QNewPage;
import com.appsmith.server.domains.User;
import com.appsmith.server.dtos.PageDTO;
import com.appsmith.server.exceptions.AppsmithError;
import com.appsmith.server.exceptions.AppsmithException;
import com.appsmith.server.repositories.BaseAppsmithRepositoryImpl;
import com.appsmith.server.repositories.CacheableRepositoryHelper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.ReactiveMongoOperations;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;

import static org.springframework.data.mongodb.core.query.Criteria.where;

@Slf4j
public class CustomNewPageRepositoryCEImpl extends BaseAppsmithRepositoryImpl<NewPage>
        implements CustomNewPageRepositoryCE {

    public CustomNewPageRepositoryCEImpl(ReactiveMongoOperations mongoOperations, MongoConverter mongoConverter, CacheableRepositoryHelper cacheableRepositoryHelper) {
        super(mongoOperations, mongoConverter, cacheableRepositoryHelper);
    }

    @Override
    public Flux<NewPage> findByApplicationId(String applicationId, AclPermission aclPermission) {
        Criteria applicationIdCriteria = where(fieldName(QNewPage.newPage.applicationId)).is(applicationId);
        return queryAll(List.of(applicationIdCriteria), aclPermission);
    }

    @Override
    public Flux<NewPage> findByApplicationIdAndNonDeletedEditMode(String applicationId, AclPermission aclPermission) {
        Criteria applicationIdCriteria = where(fieldName(QNewPage.newPage.applicationId)).is(applicationId);
        // In case a page has been deleted in edit mode, but still exists in deployed mode, NewPage object would exist. To handle this, only fetch non-deleted pages
        Criteria activeEditModeCriteria = where(fieldName(QNewPage.newPage.unpublishedPage) + "." + fieldName(QNewPage.newPage.unpublishedPage.deletedAt)).is(null);
        return queryAll(List.of(applicationIdCriteria, activeEditModeCriteria), aclPermission);
    }

    @Override
    public Mono<NewPage> findRootApplicationIdById(String id, AclPermission permission) {
        if (id == null) {
            return Mono.error(new AppsmithException(AppsmithError.INVALID_PARAMETER, FieldName.ID));
        }
        return ReactiveSecurityContextHolder.getContext()
                .map(ctx -> ctx.getAuthentication())
                .map(auth -> auth.getPrincipal())
                .flatMap(principal -> getAllPermissionGroupsForUser((User) principal))
                .flatMap(permissionGroups -> {
                    Query query = new Query(getIdCriteria(id));
                    query.fields().include(FieldName.APPLICATION_ID, FieldName.DEFAULT_RESOURCES);
                    query.addCriteria(new Criteria().andOperator(notDeleted(), userAcl(permissionGroups, permission)));

                    return mongoOperations.query(this.genericDomain)
                            .matching(query)
                            .one()
                            .flatMap(obj -> setUserPermissionsInObject(obj, permissionGroups));
                });
    }

    @Override
    public Mono<NewPage> findByIdAndLayoutsIdAndViewMode(String id, String layoutId, AclPermission aclPermission, Boolean viewMode) {
        String layoutsIdKey;
        String layoutsKey;

        List<Criteria> criteria = new ArrayList<>();
        Criteria idCriterion = getIdCriteria(id);
        criteria.add(idCriterion);

        if (Boolean.TRUE.equals(viewMode)) {
            layoutsKey = fieldName(QNewPage.newPage.publishedPage) + "." + fieldName(QNewPage.newPage.publishedPage.layouts);
        } else {
            layoutsKey = fieldName(QNewPage.newPage.unpublishedPage) + "." + fieldName(QNewPage.newPage.unpublishedPage.layouts);

            // In case a page has been deleted in edit mode, but still exists in deployed mode, NewPage object would exist. To handle this, only fetch non-deleted pages
            Criteria deletedCriterion = where(fieldName(QNewPage.newPage.unpublishedPage) + "." + fieldName(QNewPage.newPage.unpublishedPage.deletedAt)).is(null);
            criteria.add(deletedCriterion);
        }
        layoutsIdKey = layoutsKey + "." + fieldName(QLayout.layout.id);

        Criteria layoutCriterion = where(layoutsIdKey).is(layoutId);
        criteria.add(layoutCriterion);

        return queryOne(criteria, aclPermission);
    }

    @Override
    public Mono<NewPage> findByNameAndViewMode(String name, AclPermission aclPermission, Boolean viewMode) {

        List<Criteria> criteria = new ArrayList<>();

        Criteria nameCriterion = getNameCriterion(name, viewMode);
        criteria.add(nameCriterion);

        if (Boolean.FALSE.equals(viewMode)) {
            // In case a page has been deleted in edit mode, but still exists in deployed mode, NewPage object would exist. To handle this, only fetch non-deleted pages
            Criteria deletedCriterion = where(fieldName(QNewPage.newPage.unpublishedPage) + "." + fieldName(QNewPage.newPage.unpublishedPage.deletedAt)).is(null);
            criteria.add(deletedCriterion);
        }

        return queryOne(criteria, aclPermission);
    }

    @Override
    public Mono<NewPage> findByNameAndApplicationIdAndViewMode(String name, String applicationId, AclPermission aclPermission, Boolean viewMode) {

        List<Criteria> criteria = new ArrayList<>();

        Criteria nameCriterion = getNameCriterion(name, viewMode);
        criteria.add(nameCriterion);

        Criteria applicationIdCriterion = where(fieldName(QNewPage.newPage.applicationId)).is(applicationId);
        criteria.add(applicationIdCriterion);

        if (Boolean.FALSE.equals(viewMode)) {
            // In case a page has been deleted in edit mode, but still exists in deployed mode, NewPage object would exist. To handle this, only fetch non-deleted pages
            Criteria deletedCriteria = where(fieldName(QNewPage.newPage.unpublishedPage) + "." + fieldName(QNewPage.newPage.unpublishedPage.deletedAt)).is(null);
            criteria.add(deletedCriteria);
        }

        return queryOne(criteria, aclPermission);
    }

    @Override
    public Flux<NewPage> findAllByIds(List<String> ids, AclPermission aclPermission) {
        Criteria idsCriterion = where("id")
                .in(ids);

        return queryAll(List.of(idsCriterion), aclPermission);
    }

    private Criteria getNameCriterion(String name, Boolean viewMode) {
        String nameKey;

        if (Boolean.TRUE.equals(viewMode)) {
            nameKey = fieldName(QNewPage.newPage.publishedPage) + "." + fieldName(QNewPage.newPage.publishedPage.name);
        } else {
            nameKey = fieldName(QNewPage.newPage.unpublishedPage) + "." + fieldName(QNewPage.newPage.unpublishedPage.name);
        }
        return where(nameKey).is(name);
    }

    @Override
    public Mono<String> getNameByPageId(String pageId, boolean isPublishedName) {
        return mongoOperations
                .query(NewPage.class)
                .matching(Query.query(Criteria.where(fieldName(QNewPage.newPage.id)).is(pageId)))
                .one()
                .map(p -> {
                    PageDTO page = (isPublishedName ? p.getPublishedPage() : p.getUnpublishedPage());
                    if (page != null) {
                        return page.getName();
                    }
                    // If the page hasn't been published, just send the unpublished page name
                    return p.getUnpublishedPage().getName();
                });
    }

    @Override
    public Mono<NewPage> findPageByBranchNameAndDefaultPageId(String branchName, String defaultPageId, AclPermission permission) {
        final String defaultResources = fieldName(QNewPage.newPage.defaultResources);
        Criteria defaultPageIdCriteria = where(defaultResources + "." + FieldName.PAGE_ID).is(defaultPageId);
        Criteria branchCriteria = where(defaultResources + "." + FieldName.BRANCH_NAME).is(branchName);
        return queryOne(List.of(defaultPageIdCriteria, branchCriteria), permission);
    }

    @Override
    public Flux<NewPage> findSlugsByApplicationIds(List<String> applicationIds, AclPermission aclPermission) {
        Criteria applicationIdCriteria = where(fieldName(QNewPage.newPage.applicationId)).in(applicationIds);
        String unpublishedSlugFieldPath = String.format(
                "%s.%s", fieldName(QNewPage.newPage.unpublishedPage), fieldName(QNewPage.newPage.unpublishedPage.slug)
        );
        String unpublishedCustomSlugFieldPath = String.format(
                "%s.%s", fieldName(QNewPage.newPage.unpublishedPage), fieldName(QNewPage.newPage.unpublishedPage.customSlug)
        );
        String publishedSlugFieldPath = String.format(
                "%s.%s", fieldName(QNewPage.newPage.publishedPage), fieldName(QNewPage.newPage.publishedPage.slug)
        );
        String publishedCustomSlugFieldPath = String.format(
                "%s.%s", fieldName(QNewPage.newPage.publishedPage), fieldName(QNewPage.newPage.publishedPage.customSlug)
        );
        String applicationIdFieldPath = fieldName(QNewPage.newPage.applicationId);

        return queryAll(
                List.of(applicationIdCriteria),
                List.of(unpublishedSlugFieldPath, unpublishedCustomSlugFieldPath, publishedSlugFieldPath, publishedCustomSlugFieldPath, applicationIdFieldPath),
                aclPermission,
                null
        );
    }
}
