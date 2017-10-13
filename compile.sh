docker build -t wildapplications/account:latest . &&
kubectl scale --replicas=0 deployment deployment --namespace=account &&
kubectl scale --replicas=2 deployment deployment --namespace=account
